import "@testing-library/jest-dom";
import moxios from "moxios";
import {
  QueryClient,
  QueryClientProvider,
  createQuery,
} from "@tanstack/solid-query";
import { render, waitFor, screen, fireEvent } from "solid-testing-library";
import { Zodios, ZodiosInstance, makeApi, ZodiosError } from "@zodios/core";
import z from "zod";
import { ZodiosHooks, ZodiosHooksInstance } from "./hooks";
import { createSignal, For, Match, Show, Switch } from "solid-js";

function sleep(timeout: number): Promise<void> {
  return new Promise((resolve, _reject) => {
    setTimeout(resolve, timeout);
  });
}

const fail: boolean = true;

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
});

type User = z.infer<typeof userSchema>;

const api = makeApi([
  {
    method: "get",
    path: "/users",
    alias: "getUsers",
    description: "Get all users",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().positive().optional(),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().positive().optional(),
      },
    ],
    response: z.object({
      page: z.number(),
      count: z.number(),
      nextPage: z.number().optional(),
      users: z.array(userSchema),
    }),
  },
  {
    method: "post",
    path: "/users/search",
    alias: "searchUsers",
    description: "Search users",
    immutable: true,
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({
          name: z.string(),
          page: z.number().positive().optional(),
          limit: z.number().positive().optional(),
        }),
      },
    ],
    response: z.object({
      page: z.number(),
      count: z.number(),
      nextPage: z.number().optional(),
      users: z.array(userSchema),
    }),
  },
  {
    method: "get",
    path: "/users/:id",
    alias: "getUser",
    response: userSchema,
  },
  {
    method: "get",
    path: "/users/:id/address/:address",
    alias: "getUserAddress",
    response: z.object({
      id: z.number(),
      address: z.string(),
    }),
  },
  {
    method: "post",
    path: "/users",
    alias: "createUser",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({
          name: z.string(),
        }),
      },
    ],
    response: userSchema,
  },
  {
    method: "put",
    path: "/users/:id",
    alias: "updateUser",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({
          id: z.number(),
          name: z.string(),
        }),
      },
    ],
    response: userSchema,
  },
  {
    method: "patch",
    path: "/users/:id",
    alias: "patchUser",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z
          .object({
            id: z.number(),
            name: z.string(),
          })
          .partial(),
      },
    ],
    response: userSchema,
  },
  {
    method: "delete",
    path: "/users/:id",
    alias: "deleteUser",
    response: userSchema,
  },
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe("zodios hooks", () => {
  let apiClient: ZodiosInstance<typeof api>;
  let apiHooks: ZodiosHooksInstance<typeof api>;

  describe("keys", () => {
    beforeAll(() => {
      apiClient = new Zodios(api);
      apiHooks = new ZodiosHooks("test", apiClient);
    });
    it("should get back endpoint key", () => {
      const key = apiHooks.getKeyByPath("get", "/users/:id", {
        params: { id: 1 },
      });
      expect(key).toEqual([
        { api: "test", path: "/users/:id" },
        { params: { id: 1 } },
      ]);
    });

    it("should throw on invalid endpoint", () => {
      expect(() =>
        // @ts-expect-error
        apiHooks.getKeyByPath("get", "/users/:id/bad", {
          params: { id: 1 },
        })
      ).toThrow("No endpoint found for path 'get /users/:id/bad'");
    });

    it("should get back endpoint invalidation key", () => {
      const key = apiHooks.getKeyByPath("get", "/users/:id");
      expect(key).toEqual([{ api: "test", path: "/users/:id" }]);
    });

    it("should throw on invalid invalidation endpoint", () => {
      expect(() =>
        // @ts-expect-error
        apiHooks.getKeyByPath("get", "/users/:id/bad")
      ).toThrow("No endpoint found for path 'get /users/:id/bad'");
    });

    it("should get back alias key", () => {
      const key = apiHooks.getKeyByAlias("getUser", {
        params: { id: 1 },
      });
      expect(key).toEqual([
        { api: "test", path: "/users/:id" },
        { params: { id: 1 } },
      ]);
    });

    it("should throw on invalid alias", () => {
      expect(() =>
        // @ts-expect-error
        apiHooks.getKeyByAlias("getTest", {
          params: { id: 1 },
        })
      ).toThrow("No endpoint found for alias 'getTest'");
    });

    it("should get back alias invalidation key", () => {
      const key = apiHooks.getKeyByAlias("getUser");
      expect(key).toEqual([{ api: "test", path: "/users/:id" }]);
    });

    it("should throw on invalid invalidation alias", () => {
      expect(() =>
        // @ts-expect-error
        apiHooks.getKeyByAlias("getTest")
      ).toThrow("No endpoint found for alias 'getTest'");
    });
  });

  describe("hooks", () => {
    beforeAll(async () => {
      apiClient = new Zodios(api, {
        validate: true,
      });

      apiHooks = new ZodiosHooks("test", apiClient);
    });

    beforeEach(() => {
      // @ts-ignore
      moxios.install(apiClient.axios);
      queryClient.clear();
    });

    afterEach(() => {
      // @ts-ignore
      moxios.uninstall(apiClient.axios);
    });

    it("should get id", async () => {
      moxios.stubRequest(/\/users\/1/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          id: 1,
          name: "John",
        },
      });
      function Page() {
        const state = apiHooks.createGet("/users/:id", {
          params: { id: 1 },
        });

        return (
          <Switch>
            <Match when={state.isLoading}>Loading...</Match>
            <Match when={state.isError}>
              Error: {(state.error as Error).message}
            </Match>
            <Match when={state.isSuccess}>
              <div>
                <h1>{state.data!.name}</h1>
              </div>
            </Match>
          </Switch>
        );
      }

      render(() => (
        <QueryClientProvider client={queryClient}>
          <Page />
        </QueryClientProvider>
      ));

      screen.getByText("Loading...");

      await waitFor(() => screen.getByText("John"));
    });

    it("should get id with validation error", async () => {
      moxios.stubRequest(/\/users\/1/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          id: 1,
          names: "John",
        },
      });
      function Page() {
        const state = apiHooks.createGet("/users/:id", {
          params: { id: 1 },
        });

        return (
          <Switch>
            <Match when={state.isLoading}>Loading...</Match>
            <Match when={state.isError}>
              <div data-testid="error">
                Error: {(state.error as Error).message}
              </div>
            </Match>
            <Match when={state.isSuccess}>
              <div>
                <h1>{state.data!.name}</h1>
              </div>
            </Match>
          </Switch>
        );
      }

      render(() => (
        <QueryClientProvider client={queryClient}>
          <Page />
        </QueryClientProvider>
      ));

      screen.getByText("Loading...");

      const error = await waitFor(() => screen.getByTestId("error"));
      expect(error).toHaveTextContent(
        "Zodios: Invalid response from endpoint 'get /users/:id'"
      );
    });

    it("should get id with alias", async () => {
      moxios.stubRequest(/\/users\/1/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          id: 1,
          name: "John",
        },
      });
      function Page() {
        const state = apiHooks.createGetUser({
          params: { id: 1 },
        });

        return (
          <Switch>
            <Match when={state.isLoading}>Loading...</Match>
            <Match when={state.isError}>
              Error: {(state.error as Error).message}
            </Match>
            <Match when={state.isSuccess}>
              <div>
                <h1>{state.data!.name}</h1>
              </div>
            </Match>
          </Switch>
        );
      }

      render(() => (
        <QueryClientProvider client={queryClient}>
          <Page />
        </QueryClientProvider>
      ));

      screen.getByText("Loading...");

      await waitFor(() => screen.getByText("John"));
    });

    it("should get id with alias and be reactive", async () => {
      moxios.stubRequest(/\/users\/1/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          id: 1,
          name: "John",
        },
      });
      moxios.stubRequest(/\/users\/2/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          id: 2,
          name: "Jane",
        },
      });
      function Page() {
        const [id, setId] = createSignal(1);
        const state = apiHooks.createGetUser({
          params: {
            get id() {
              return id();
            },
          },
        });

        return (
          <>
            <button onClick={() => setId(2)}>Change</button>
            <Switch>
              <Match when={state.isLoading}>Loading...</Match>
              <Match when={state.isError}>
                Error: {(state.error as Error).message}
              </Match>
              <Match when={state.isSuccess}>
                <div>
                  <h1>{state.data!.name}</h1>
                </div>
              </Match>
            </Switch>
          </>
        );
      }

      render(() => (
        <QueryClientProvider client={queryClient}>
          <Page />
        </QueryClientProvider>
      ));

      screen.getByText("Loading...");

      await waitFor(() => screen.getByText("John"));
      fireEvent.click(screen.getByText("Change"));
      await waitFor(() => screen.getByText("Jane"));
    });

    it("should get with :id and :address", async () => {
      moxios.stubRequest(/\/users\/1\/address\/123/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          id: 1,
          address: "123, test avenue",
        },
      });
      function Page() {
        const state = apiHooks.createGet("/users/:id/address/:address", {
          params: { id: 1, address: "123" },
        });

        return (
          <Switch>
            <Match when={state.isLoading}>Loading...</Match>
            <Match when={state.isError}>
              Error: {(state.error as Error).message}
            </Match>
            <Match when={state.isSuccess}>
              <div>
                <h1>{state.data!.address}</h1>
              </div>
            </Match>
          </Switch>
        );
      }

      render(() => (
        <QueryClientProvider client={queryClient}>
          <Page />
        </QueryClientProvider>
      ));

      screen.getByText("Loading...");

      await waitFor(() => screen.getByText("123, test avenue"));
    });

    it("should create user", async () => {
      moxios.stubRequest(/\/users/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          id: 1,
          name: "John",
        },
      });
      function Page() {
        const [user, setUser] = createSignal<User | undefined>(undefined);
        const state = apiHooks.createPost("/users", undefined, {
          onSuccess: (data) => {
            setUser(data);
          },
        });

        return (
          <>
            <button onClick={() => state.mutate({ name: "John" })}>
              create
            </button>
            <Switch>
              <Match when={user() === undefined}>Loading...</Match>
              <Match when={user()}>
                <div>
                  <h1>{user()!.name}</h1>
                </div>
              </Match>
            </Switch>
          </>
        );
      }

      render(() => (
        <QueryClientProvider client={queryClient}>
          <Page />
        </QueryClientProvider>
      ));

      fireEvent.click(screen.getByText("create"));

      await waitFor(() => screen.getByText("John"));
    });

    it("should create user by alias", async () => {
      moxios.stubRequest(/\/users/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          id: 1,
          name: "John",
        },
      });
      function Page() {
        const [user, setUser] = createSignal<User | undefined>(undefined);
        const state = apiHooks.createCreateUser(undefined, {
          onSuccess: (data) => {
            setUser(data);
          },
        });

        return (
          <>
            <button onClick={() => state.mutate({ name: "John" })}>
              create
            </button>
            <Switch>
              <Match when={user() === undefined}>Loading...</Match>
              <Match when={user()}>
                <div>
                  <h1>{user()!.name}</h1>
                </div>
              </Match>
            </Switch>
          </>
        );
      }

      render(() => (
        <QueryClientProvider client={queryClient}>
          <Page />
        </QueryClientProvider>
      ));

      fireEvent.click(screen.getByText("create"));

      await waitFor(() => screen.getByText("John"));
    });

    it("should search immutable users", async () => {
      moxios.stubRequest(/\/users\/search/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          page: 1,
          count: 1,
          users: [
            {
              id: 1,
              name: "John",
            },
          ],
        },
      });
      function Page() {
        const state = apiHooks.createImmutableQuery("/users/search", {
          name: "John",
        });

        return (
          <Switch>
            <Match when={state.isLoading}>Loading...</Match>
            <Match when={state.isError}>
              Error: {(state.error as Error).message}
            </Match>
            <Match when={state.isSuccess}>
              <div>
                <h1>{state.data!.users[0].name}</h1>
              </div>
            </Match>
          </Switch>
        );
      }

      render(() => (
        <QueryClientProvider client={queryClient}>
          <Page />
        </QueryClientProvider>
      ));

      screen.getByText("Loading...");

      await waitFor(() => screen.getByText("John"));
    });

    it("should search immutable users by alias", async () => {
      moxios.stubRequest(/\/users\/search/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          page: 1,
          count: 1,
          users: [
            {
              id: 1,
              name: "John",
            },
          ],
        },
      });
      function Page() {
        const state = apiHooks.createSearchUsers({
          name: "John",
        });

        return (
          <Switch>
            <Match when={state.isLoading}>Loading...</Match>
            <Match when={state.isError}>
              Error: {(state.error as Error).message}
            </Match>
            <Match when={state.isSuccess}>
              <div>
                <h1>{state.data!.users[0].name}</h1>
              </div>
            </Match>
          </Switch>
        );
      }

      render(() => (
        <QueryClientProvider client={queryClient}>
          <Page />
        </QueryClientProvider>
      ));

      screen.getByText("Loading...");

      await waitFor(() => screen.getByText("John"));
    });

    it("should update user", async () => {
      moxios.stubRequest(/\/users/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          id: 1,
          name: "Jane",
        },
      });
      function Page() {
        const [user, setUser] = createSignal<User | undefined>(undefined);
        const state = apiHooks.createPut(
          "/users/:id",
          {
            params: { id: 1 },
          },
          {
            onSuccess: (data) => {
              setUser(data);
            },
          }
        );

        return (
          <>
            <button onClick={() => state.mutate({ name: "Jane", id: 1 })}>
              update
            </button>
            <Switch>
              <Match when={user() === undefined}>Loading...</Match>
              <Match when={user()}>
                <div>
                  <h1>{user()!.name}</h1>
                </div>
              </Match>
            </Switch>
          </>
        );
      }

      render(() => (
        <QueryClientProvider client={queryClient}>
          <Page />
        </QueryClientProvider>
      ));

      fireEvent.click(screen.getByText("update"));

      await waitFor(() => screen.getByText("Jane"));
    });

    it("should update user by alias", async () => {
      moxios.stubRequest(/\/users/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          id: 1,
          name: "Jane",
        },
      });
      function Page() {
        const [user, setUser] = createSignal<User | undefined>(undefined);
        const state = apiHooks.createUpdateUser(
          {
            params: { id: 1 },
          },
          {
            onSuccess: (data) => {
              setUser(data);
            },
          }
        );

        return (
          <>
            <button onClick={() => state.mutate({ name: "Jane", id: 1 })}>
              update
            </button>
            <Switch>
              <Match when={user() === undefined}>Loading...</Match>
              <Match when={user()}>
                <div>
                  <h1>{user()!.name}</h1>
                </div>
              </Match>
            </Switch>
          </>
        );
      }

      render(() => (
        <QueryClientProvider client={queryClient}>
          <Page />
        </QueryClientProvider>
      ));

      fireEvent.click(screen.getByText("update"));

      await waitFor(() => screen.getByText("Jane"));
    });

    it("should patch user", async () => {
      moxios.stubRequest(/\/users/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          id: 1,
          name: "Jane",
        },
      });
      function Page() {
        const [user, setUser] = createSignal<User | undefined>(undefined);
        const state = apiHooks.createPatch(
          "/users/:id",
          {
            params: { id: 1 },
          },
          {
            onSuccess: (data) => {
              setUser(data);
            },
          }
        );

        return (
          <>
            <button onClick={() => state.mutate({ name: "Jane" })}>
              patch
            </button>
            <Switch>
              <Match when={user() === undefined}>Loading...</Match>
              <Match when={user()}>
                <div>
                  <h1>{user()!.name}</h1>
                </div>
              </Match>
            </Switch>
          </>
        );
      }

      render(() => (
        <QueryClientProvider client={queryClient}>
          <Page />
        </QueryClientProvider>
      ));

      fireEvent.click(screen.getByText("patch"));

      await waitFor(() => screen.getByText("Jane"));
    });

    it("should patch user by alias", async () => {
      moxios.stubRequest(/\/users/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          id: 1,
          name: "Jane",
        },
      });
      function Page() {
        const [user, setUser] = createSignal<User | undefined>(undefined);
        const state = apiHooks.createPatchUser(
          {
            params: { id: 1 },
          },
          {
            onSuccess: (data) => {
              setUser(data);
            },
          }
        );

        return (
          <>
            <button onClick={() => state.mutate({ name: "Jane" })}>
              patch
            </button>
            <Switch>
              <Match when={user() === undefined}>Loading...</Match>
              <Match when={user()}>
                <div>
                  <h1>{user()!.name}</h1>
                </div>
              </Match>
            </Switch>
          </>
        );
      }

      render(() => (
        <QueryClientProvider client={queryClient}>
          <Page />
        </QueryClientProvider>
      ));

      fireEvent.click(screen.getByText("patch"));

      await waitFor(() => screen.getByText("Jane"));
    });

    it("should delete user", async () => {
      moxios.stubRequest(/\/users/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          id: 1,
          name: "Jane",
        },
      });
      function Page() {
        const [user, setUser] = createSignal<User | undefined>(undefined);
        const state = apiHooks.createDelete(
          "/users/:id",
          {
            params: { id: 1 },
          },
          {
            onSuccess: (data) => {
              setUser(data);
            },
          }
        );

        return (
          <>
            <button onClick={() => state.mutate(undefined)}>patch</button>
            <Switch>
              <Match when={user() === undefined}>Loading...</Match>
              <Match when={user()}>
                <div>
                  <h1>{user()!.name}</h1>
                </div>
              </Match>
            </Switch>
          </>
        );
      }

      render(() => (
        <QueryClientProvider client={queryClient}>
          <Page />
        </QueryClientProvider>
      ));

      fireEvent.click(screen.getByText("patch"));

      await waitFor(() => screen.getByText("Jane"));
    });

    it("should delete user by alias", async () => {
      moxios.stubRequest(/\/users/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          id: 1,
          name: "Jane",
        },
      });
      function Page() {
        const [user, setUser] = createSignal<User | undefined>(undefined);
        const state = apiHooks.createDeleteUser(
          {
            params: { id: 1 },
          },
          {
            onSuccess: (data) => {
              setUser(data);
            },
          }
        );

        return (
          <>
            <button onClick={() => state.mutate(undefined)}>patch</button>
            <Switch>
              <Match when={user() === undefined}>Loading...</Match>
              <Match when={user()}>
                <div>
                  <h1>{user()!.name}</h1>
                </div>
              </Match>
            </Switch>
          </>
        );
      }

      render(() => (
        <QueryClientProvider client={queryClient}>
          <Page />
        </QueryClientProvider>
      ));

      fireEvent.click(screen.getByText("patch"));

      await waitFor(() => screen.getByText("Jane"));
    });

    it("should infinite load users", async () => {
      moxios.stubRequest(/page=2/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          page: 2,
          count: 2,
          users: [
            {
              id: 3,
              name: "Mike",
            },
            {
              id: 4,
              name: "Mary",
            },
          ],
        },
      });

      moxios.stubRequest(/\/users/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          page: 1,
          count: 2,
          nextPage: 2,
          users: [
            {
              id: 1,
              name: "John",
            },
            {
              id: 2,
              name: "Jane",
            },
          ],
        },
      });

      function Page() {
        const state = apiHooks.createInfiniteQuery(
          "/users",
          {
            queries: {
              limit: 2,
            },
          },
          {
            getPageParamList: () => ["page"],
            getNextPageParam: (lastPage) =>
              lastPage.nextPage
                ? {
                    queries: {
                      page: lastPage.nextPage,
                    },
                  }
                : undefined,
          }
        );

        return (
          <>
            <Show when={state.hasNextPage}>
              <button onClick={() => state.fetchNextPage()}>next</button>
            </Show>
            <Switch>
              <Match when={state.isLoading}>Loading...</Match>
              <Match when={state.isFetchingNextPage}>Fetching...</Match>
              <Match when={!state.isFetching}>
                <ul>
                  <For each={state.data?.pages}>
                    {(page) => (
                      <For each={page.users}>
                        {(user) => <li>{user.name}</li>}
                      </For>
                    )}
                  </For>
                </ul>
              </Match>
            </Switch>
          </>
        );
      }
      render(() => (
        <QueryClientProvider client={queryClient}>
          <Page />
        </QueryClientProvider>
      ));

      await waitFor(() => screen.getByText("John"));
      await waitFor(() => screen.getByText("Jane"));

      fireEvent.click(screen.getByText("next"));

      await waitFor(() => screen.getByText("Mike"));
      await waitFor(() => screen.getByText("Mary"));
    });

    it("should infinite search users", async () => {
      moxios.stubOnce("POST", /\/users\/search/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          page: 1,
          count: 2,
          nextPage: 2,
          users: [
            {
              id: 1,
              name: "User 1",
            },
            {
              id: 2,
              name: "User 2",
            },
          ],
        },
      });

      function Page() {
        const state = apiHooks.createImmutableInfiniteQuery(
          "/users/search",
          {
            name: "User",
          },
          undefined,
          {
            getPageParamList: () => ["page"],
            getNextPageParam: (lastPage) =>
              lastPage.nextPage
                ? {
                    body: {
                      page: lastPage.nextPage,
                    },
                  }
                : undefined,
          }
        );

        return (
          <>
            <Show when={state.hasNextPage}>
              <button onClick={() => state.fetchNextPage()}>next</button>
            </Show>
            <Switch>
              <Match when={state.isLoading}>Loading...</Match>
              <Match when={state.isFetchingNextPage}>Fetching...</Match>
              <Match when={!state.isFetching}>
                <ul>
                  <For each={state.data?.pages}>
                    {(page) => (
                      <For each={page.users}>
                        {(user) => <li>{user.name}</li>}
                      </For>
                    )}
                  </For>
                </ul>
              </Match>
            </Switch>
          </>
        );
      }
      render(() => (
        <QueryClientProvider client={queryClient}>
          <Page />
        </QueryClientProvider>
      ));

      await waitFor(() => screen.getByText("User 1"));
      await waitFor(() => screen.getByText("User 2"));

      moxios.uninstall();
      moxios.install();

      moxios.stubOnce("POST", /\/users\/search/, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        response: {
          page: 2,
          count: 2,
          users: [
            {
              id: 3,
              name: "User 3",
            },
            {
              id: 4,
              name: "User 4",
            },
          ],
        },
      });

      fireEvent.click(screen.getByText("next"));

      await waitFor(() => screen.getByText("User 3"));
      await waitFor(() => screen.getByText("User 4"));
    });
  });
});
