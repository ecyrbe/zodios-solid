import { createSignal, For, Match, Show, Switch } from "solid-js";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { makeApi, Zodios } from "@zodios/core";
import { ZodiosHooks } from "../src";
import { z } from "zod";

// you can define schema before declaring the API to get back the type
const userSchema = z
  .object({
    id: z.number(),
    name: z.string(),
  })
  .required();

const createUserSchema = z
  .object({
    name: z.string(),
  })
  .required();

const usersSchema = z.array(userSchema);

// you can then get back the types
type User = z.infer<typeof userSchema>;
type Users = z.infer<typeof usersSchema>;

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
    response: usersSchema,
  },
  {
    method: "get",
    path: "/users/:id",
    alias: "getUser",
    description: "Get a user",
    response: userSchema,
  },
  {
    method: "post",
    path: "/users",
    alias: "createUser",
    description: "Create a user",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: createUserSchema,
      },
    ],
    response: userSchema,
  },
]);
const baseUrl = "https://jsonplaceholder.typicode.com";

const zodios = new Zodios(baseUrl, api);
const zodiosHooks = new ZodiosHooks("jsonplaceholder", zodios);

const Users = () => {
  const [page, setPage] = createSignal(0);
  const users = zodiosHooks.createInfiniteQuery(
    "/users",
    { queries: { limit: 10 } },
    {
      getPageParamList: () => {
        return ["page"];
      },
      getNextPageParam: () => {
        return {
          queries: {
            get page() {
              return page() + 1;
            },
          },
        };
      },
    }
  );
  const user = zodiosHooks.createCreateUser(undefined, {
    onSuccess: () => users.invalidate(),
  });

  return (
    <>
      <button onClick={() => user.mutate({ name: "john" })}>create user</button>
      <Show when={users.hasNextPage}>
        <button onClick={() => users.fetchNextPage()}>next</button>
      </Show>
      <Switch>
        <Match when={users.isLoading}>Loading...</Match>
        <Match when={users.isFetchingNextPage}>Fetching...</Match>
        <Match when={!users.isFetching}>
          <ul>
            <For each={users.data?.pages}>
              {(user) => (
                <For each={user}>{(user) => <li>{user.name}</li>}</For>
              )}
            </For>
          </ul>
        </Match>
      </Switch>
    </>
  );
};

// on another file
const queryClient = new QueryClient();

export const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Users />
    </QueryClientProvider>
  );
};
