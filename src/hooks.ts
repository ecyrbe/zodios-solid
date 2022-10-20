import {
  createQuery,
  CreateQueryOptions,
  CreateQueryResult,
  createMutation,
  CreateMutationOptions,
  CreateMutationResult,
  MutationFunction,
  createInfiniteQuery,
  CreateInfiniteQueryOptions,
  CreateInfiniteQueryResult,
  useQueryClient,
  QueryFunctionContext,
  QueryKey,
} from "@tanstack/solid-query";
import { ZodiosError, ZodiosInstance } from "@zodios/core";
import type {
  AnyZodiosMethodOptions,
  Method,
  ZodiosBodyByPath,
  ZodiosBodyByAlias,
  ZodiosPathsByMethod,
  ZodiosResponseByPath,
  ZodiosResponseByAlias,
  ZodiosEndpointDefinition,
  ZodiosEndpointDefinitions,
  ZodiosEndpointDefinitionByAlias,
  ZodiosRequestOptionsByPath,
  ZodiosRequestOptions,
  ZodiosQueryParamsByPath,
  ZodiosRequestOptionsByAlias,
} from "@zodios/core";
import { AxiosError } from "axios";
import type {
  Aliases,
  MutationMethod,
  ZodiosAliases,
} from "@zodios/core/lib/zodios.types";
import type {
  IfEquals,
  PathParamNames,
  ReadonlyDeep,
  RequiredKeys,
} from "@zodios/core/lib/utils.types";
import { capitalize, pick, omit } from "./utils";

type UndefinedIfNever<T> = IfEquals<T, never, undefined, T>;
type Errors = Error | ZodiosError | AxiosError;

type MutationOptions<
  Api extends ZodiosEndpointDefinition[],
  M extends Method,
  Path extends ZodiosPathsByMethod<Api, M>
> = Omit<
  CreateMutationOptions<
    Awaited<ZodiosResponseByPath<Api, M, Path>>,
    Errors,
    UndefinedIfNever<ZodiosBodyByPath<Api, M, Path>>
  >,
  "mutationFn"
>;

type MutationOptionsByAlias<
  Api extends ZodiosEndpointDefinitions,
  Alias extends string
> = Omit<
  CreateMutationOptions<
    Awaited<ZodiosResponseByAlias<Api, Alias>>,
    Errors,
    UndefinedIfNever<ZodiosBodyByAlias<Api, Alias>>
  >,
  "mutationFn"
>;

type QueryOptions<
  Api extends ZodiosEndpointDefinitions,
  Path extends ZodiosPathsByMethod<Api, "get">
> = Awaited<CreateQueryOptions<ZodiosResponseByPath<Api, "get", Path>, Errors>>;

type QueryOptionsByAlias<
  Api extends ZodiosEndpointDefinitions,
  Alias extends string
> = Awaited<CreateQueryOptions<ZodiosResponseByAlias<Api, Alias>, Errors>>;

type ImmutableQueryOptions<
  Api extends ZodiosEndpointDefinitions,
  M extends Method,
  Path extends ZodiosPathsByMethod<Api, M>
> = Awaited<CreateQueryOptions<ZodiosResponseByPath<Api, M, Path>, Errors>>;

type InfiniteQueryOptions<
  Api extends ZodiosEndpointDefinitions,
  Path extends ZodiosPathsByMethod<Api, "get">
> = Awaited<
  CreateInfiniteQueryOptions<ZodiosResponseByPath<Api, "get", Path>, Errors>
>;

export type ImmutableInfiniteQueryOptions<
  Api extends ZodiosEndpointDefinitions,
  M extends Method,
  Path extends ZodiosPathsByMethod<Api, M>
> = Awaited<
  CreateInfiniteQueryOptions<ZodiosResponseByPath<Api, M, Path>, Errors>
>;

export class ZodiosHooksClass<Api extends ZodiosEndpointDefinitions> {
  constructor(
    private readonly apiName: string,
    private readonly zodios: ZodiosInstance<Api>
  ) {
    this.injectAliasEndpoints();
  }

  private injectAliasEndpoints() {
    this.zodios.api.forEach((endpoint) => {
      if (endpoint.alias) {
        if (["post", "put", "patch", "delete"].includes(endpoint.method)) {
          if (endpoint.method === "post" && endpoint.immutable) {
            (this as any)[`create${capitalize(endpoint.alias)}`] = (
              body: any,
              config: any,
              mutationOptions: any
            ) =>
              this.createImmutableQuery(
                endpoint.path as any,
                body,
                config,
                mutationOptions
              );
          } else {
            (this as any)[`create${capitalize(endpoint.alias)}`] = (
              config: any,
              mutationOptions: any
            ) =>
              this.createMutation(
                endpoint.method,
                endpoint.path as any,
                config,
                mutationOptions
              );
          }
        } else {
          (this as any)[`create${capitalize(endpoint.alias)}`] = (
            config: any,
            queryOptions: any
          ) => this.createQuery(endpoint.path as any, config, queryOptions);
        }
      }
    });
  }

  private getEndpointByPath(method: string, path: string) {
    return this.zodios.api.find(
      (endpoint) => endpoint.method === method && endpoint.path === path
    );
  }

  private getEndpointByAlias(alias: string) {
    return this.zodios.api.find((endpoint) => endpoint.alias === alias);
  }

  /**
   * compute the key for the provided endpoint
   * @param method - HTTP method of the endpoint
   * @param path - path for the endpoint
   * @param config - parameters of the api to the endpoint - when providing no parameters, will return the common key for the endpoint
   * @returns - Key
   */
  getKeyByPath<M extends Method, Path extends ZodiosPathsByMethod<Api, Method>>(
    method: M,
    path: Path extends ZodiosPathsByMethod<Api, M> ? Path : never,
    config?: ZodiosRequestOptionsByPath<Api, M, Path>
  ) {
    const endpoint = this.getEndpointByPath(method, path);
    if (!endpoint)
      throw new Error(`No endpoint found for path '${method} ${path}'`);
    if (config) {
      const params = pick(config as AnyZodiosMethodOptions | undefined, [
        "params",
        "queries",
      ]);
      return [{ api: this.apiName, path: endpoint.path }, params] as QueryKey;
    }
    return [{ api: this.apiName, path: endpoint.path }] as QueryKey;
  }

  /**
   * compute the key for the provided endpoint alias
   * @param alias - alias of the endpoint
   * @param config - parameters of the api to the endpoint
   * @returns - QueryKey
   */
  getKeyByAlias<Alias extends keyof ZodiosAliases<Api>>(
    alias: Alias extends string ? Alias : never,
    config?: Alias extends string
      ? ZodiosRequestOptionsByAlias<Api, Alias>
      : never
  ) {
    const endpoint = this.getEndpointByAlias(alias);
    if (!endpoint) throw new Error(`No endpoint found for alias '${alias}'`);
    if (config) {
      const params = pick(config as AnyZodiosMethodOptions | undefined, [
        "params",
        "queries",
      ]);
      return [{ api: this.apiName, path: endpoint.path }, params] as QueryKey;
    }
    return [{ api: this.apiName, path: endpoint.path }] as QueryKey;
  }

  createQuery<
    Path extends ZodiosPathsByMethod<Api, "get">,
    TConfig extends ZodiosRequestOptionsByPath<Api, "get", Path>
  >(
    path: Path,
    ...[config, queryOptions]: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          queryOptions?: Omit<QueryOptions<Api, Path>, "queryKey" | "queryFn">
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          queryOptions?: Omit<QueryOptions<Api, Path>, "queryKey" | "queryFn">
        ]
  ) {
    const params = pick(config as AnyZodiosMethodOptions | undefined, [
      "params",
      "queries",
    ]);
    const key = [{ api: this.apiName, path }, params] as QueryKey;
    // @ts-expect-error
    const query = async () => this.zodios.get(path, config);
    const queryClient = useQueryClient();
    const invalidate = () => queryClient.invalidateQueries(key);
    const result = createQuery(
      () => key,
      query,
      queryOptions
    ) as CreateQueryResult<ZodiosResponseByPath<Api, "get", Path>, Errors> & {
      invalidate: () => Promise<void>;
      key: QueryKey;
    };
    result.key = key;
    result.invalidate = invalidate;
    return result;
  }

  createImmutableQuery<
    Path extends ZodiosPathsByMethod<Api, "post">,
    TConfig extends ZodiosRequestOptionsByPath<Api, "post", Path>
  >(
    path: Path,
    body: ReadonlyDeep<UndefinedIfNever<ZodiosBodyByPath<Api, "post", Path>>>,
    ...[config, queryOptions]: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          queryOptions?: Omit<
            ImmutableQueryOptions<Api, "post", Path>,
            "queryKey" | "queryFn"
          >
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          queryOptions?: Omit<
            ImmutableQueryOptions<Api, "post", Path>,
            "queryKey" | "queryFn"
          >
        ]
  ) {
    const params = pick(config as AnyZodiosMethodOptions | undefined, [
      "params",
      "queries",
    ]);
    const key = [{ api: this.apiName, path }, params, body] as QueryKey;
    // @ts-expect-error
    const query = () => this.zodios.post(path, body, config);
    const queryClient = useQueryClient();
    const invalidate = () => queryClient.invalidateQueries(key);
    const result = createQuery(
      () => key,
      query,
      queryOptions
    ) as CreateQueryResult<ZodiosResponseByPath<Api, "post", Path>, Errors> & {
      invalidate: () => Promise<void>;
      key: QueryKey;
    };
    result.key = key;
    result.invalidate = invalidate;
    return result;
  }

  createInfiniteQuery<
    Path extends ZodiosPathsByMethod<Api, "get">,
    TConfig extends ZodiosRequestOptionsByPath<Api, "get", Path>
  >(
    path: Path,
    ...[config, queryOptions]: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          queryOptions?: Omit<
            InfiniteQueryOptions<Api, Path>,
            "queryKey" | "queryFn"
          > & {
            getPageParamList: () => (
              | (ZodiosQueryParamsByPath<Api, "get", Path> extends never
                  ? never
                  : keyof ZodiosQueryParamsByPath<Api, "get", Path>)
              | PathParamNames<Path>
            )[];
          }
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          queryOptions?: Omit<
            InfiniteQueryOptions<Api, Path>,
            "queryKey" | "queryFn"
          > & {
            getPageParamList: () => (
              | (ZodiosQueryParamsByPath<Api, "get", Path> extends never
                  ? never
                  : keyof ZodiosQueryParamsByPath<Api, "get", Path>)
              | PathParamNames<Path>
            )[];
          }
        ]
  ) {
    const params = pick(config as AnyZodiosMethodOptions | undefined, [
      "params",
      "queries",
    ]);
    // istanbul ignore next
    if (params.params && queryOptions) {
      params.params = omit(
        params.params,
        queryOptions.getPageParamList() as string[]
      );
    }
    if (params.queries && queryOptions) {
      params.queries = omit(
        params.queries,
        queryOptions.getPageParamList() as string[]
      );
    }
    const key = [{ api: this.apiName, path }, params];
    const query = ({ pageParam = undefined }: QueryFunctionContext) =>
      this.zodios.get(path, {
        ...config,
        queries: {
          ...(config as AnyZodiosMethodOptions)?.queries,
          ...(pageParam as AnyZodiosMethodOptions)?.queries,
        },
        params: {
          ...(config as AnyZodiosMethodOptions)?.params,
          ...(pageParam as AnyZodiosMethodOptions)?.params,
        },
      } as unknown as ReadonlyDeep<TConfig>);
    const queryClient = useQueryClient();
    const invalidate = () => queryClient.invalidateQueries(key);
    const result = createInfiniteQuery(
      () => key,
      query,
      queryOptions as Omit<typeof queryOptions, "getPageParamList">
    ) as CreateInfiniteQueryResult<
      ZodiosResponseByPath<Api, "get", Path>,
      Errors
    > & {
      invalidate: () => Promise<void>;
      key: QueryKey;
    };
    result.key = key;
    result.invalidate = invalidate;
    return result;
  }

  createImmutableInfiniteQuery<
    Path extends ZodiosPathsByMethod<Api, "post">,
    TConfig extends ZodiosRequestOptionsByPath<Api, "post", Path>
  >(
    path: Path,
    body: ReadonlyDeep<UndefinedIfNever<ZodiosBodyByPath<Api, "post", Path>>>,
    ...[config, queryOptions]: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          queryOptions?: Omit<
            ImmutableInfiniteQueryOptions<Api, "post", Path>,
            "queryKey" | "queryFn"
          > & {
            getPageParamList: () => (
              | keyof ZodiosBodyByPath<Api, "post", Path>
              | PathParamNames<Path>
              | (ZodiosQueryParamsByPath<Api, "post", Path> extends never
                  ? never
                  : keyof ZodiosQueryParamsByPath<Api, "post", Path>)
            )[];
          }
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          queryOptions?: Omit<
            ImmutableInfiniteQueryOptions<Api, "post", Path>,
            "queryKey" | "queryFn"
          > & {
            getPageParamList: () => (
              | keyof ZodiosBodyByPath<Api, "post", Path>
              | PathParamNames<Path>
              | (ZodiosQueryParamsByPath<Api, "post", Path> extends never
                  ? never
                  : keyof ZodiosQueryParamsByPath<Api, "post", Path>)
            )[];
          }
        ]
  ) {
    const params = pick(config as AnyZodiosMethodOptions | undefined, [
      "params",
      "queries",
    ]);
    // istanbul ignore next
    if (params.params && queryOptions) {
      params.params = omit(
        params.params,
        queryOptions.getPageParamList() as string[]
      );
    }
    // istanbul ignore next
    if (params.queries && queryOptions) {
      params.queries = omit(
        params.queries,
        queryOptions.getPageParamList() as string[]
      );
    }
    let bodyKey;
    if (body && queryOptions) {
      bodyKey = omit(
        body,
        queryOptions.getPageParamList() as (keyof typeof body)[]
      );
    }
    const key = [{ api: this.apiName, path }, params, bodyKey];
    const query = ({ pageParam = undefined }: QueryFunctionContext) =>
      this.zodios.post(
        path,
        {
          ...body,
          ...(pageParam as any)?.body,
        },
        {
          ...config,
          queries: {
            ...(config as AnyZodiosMethodOptions)?.queries,
            ...(pageParam as AnyZodiosMethodOptions)?.queries,
          },
          params: {
            ...(config as AnyZodiosMethodOptions)?.params,
            ...(pageParam as AnyZodiosMethodOptions)?.params,
          },
        } as unknown as ReadonlyDeep<TConfig>
      );
    const queryClient = useQueryClient();
    const invalidate = () => queryClient.invalidateQueries(key);
    const result = createInfiniteQuery(
      () => key,
      query,
      queryOptions as Omit<typeof queryOptions, "getPageParamList">
    ) as CreateInfiniteQueryResult<
      ZodiosResponseByPath<Api, "post", Path>,
      Errors
    > & {
      invalidate: () => Promise<void>;
      key: QueryKey;
    };
    result.key = key;
    result.invalidate = invalidate;
    return result;
  }

  createMutation<
    M extends Method,
    Path extends ZodiosPathsByMethod<Api, M>,
    TConfig extends ZodiosRequestOptionsByPath<Api, M, Path>
  >(
    method: M,
    path: Path,
    ...[config, mutationOptions]: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, M, Path>
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, M, Path>
        ]
  ) {
    type MutationVariables = UndefinedIfNever<ZodiosBodyByPath<Api, M, Path>>;

    const mutation: MutationFunction<
      ZodiosResponseByPath<Api, M, Path>,
      MutationVariables
    > = (variables: MutationVariables) => {
      return this.zodios.request({
        ...config,
        method,
        url: path,
        data: variables,
      } as unknown as ZodiosRequestOptions<Api, M, Path>);
    };
    return createMutation(mutation, mutationOptions);
  }

  createGet<
    Path extends ZodiosPathsByMethod<Api, "get">,
    TConfig extends ZodiosRequestOptionsByPath<Api, "get", Path>
  >(
    path: Path,
    ...rest: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          queryOptions?: Omit<QueryOptions<Api, Path>, "queryKey" | "queryFn">
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          queryOptions?: Omit<QueryOptions<Api, Path>, "queryKey" | "queryFn">
        ]
  ) {
    // @ts-expect-error
    return this.createQuery(path, ...rest);
  }

  createPost<
    Path extends ZodiosPathsByMethod<Api, "post">,
    TConfig extends ReadonlyDeep<ZodiosRequestOptionsByPath<Api, "post", Path>>
  >(
    path: Path,
    ...rest: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, "post", Path>
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, "post", Path>
        ]
  ) {
    // @ts-expect-error
    return this.createMutation("post", path, ...rest);
  }

  createPut<
    Path extends ZodiosPathsByMethod<Api, "put">,
    TConfig extends ReadonlyDeep<ZodiosRequestOptionsByPath<Api, "put", Path>>
  >(
    path: Path,
    ...rest: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, "put", Path>
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, "put", Path>
        ]
  ) {
    // @ts-expect-error
    return this.createMutation("put", path, ...rest);
  }

  createPatch<
    Path extends ZodiosPathsByMethod<Api, "patch">,
    TConfig extends ReadonlyDeep<ZodiosRequestOptionsByPath<Api, "patch", Path>>
  >(
    path: Path,
    ...rest: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, "patch", Path>
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, "patch", Path>
        ]
  ) {
    // @ts-expect-error
    return this.createMutation("patch", path, ...rest);
  }

  createDelete<
    Path extends ZodiosPathsByMethod<Api, "delete">,
    TConfig extends ReadonlyDeep<
      ZodiosRequestOptionsByPath<Api, "delete", Path>
    >
  >(
    path: Path,
    ...rest: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, "post", Path>
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, "post", Path>
        ]
  ) {
    // @ts-expect-error
    return this.createMutation("delete", path, ...rest);
  }
}

export type ZodiosImmutableAliasHook<Body, Config, ImmutableOptions, Response> =
  RequiredKeys<Config> extends never
    ? (
        body: ReadonlyDeep<UndefinedIfNever<Body>>,
        configOptions?: ReadonlyDeep<Config>,
        queryOptions?: ImmutableOptions
      ) => CreateQueryResult<Response, Errors> & {
        invalidate: () => Promise<void>;
        key: QueryKey;
      }
    : (
        body: ReadonlyDeep<UndefinedIfNever<Body>>,
        configOptions: ReadonlyDeep<Config>,
        queryOptions?: ImmutableOptions
      ) => CreateQueryResult<Response, Errors> & {
        invalidate: () => Promise<void>;
        key: QueryKey;
      };

export type ZodiosMutationAliasHook<Body, Config, MutationOptions, Response> =
  RequiredKeys<Config> extends never
    ? (
        configOptions?: ReadonlyDeep<Config>,
        mutationOptions?: MutationOptions
      ) => CreateMutationResult<
        Response,
        Errors,
        UndefinedIfNever<Body>,
        unknown
      >
    : (
        configOptions: ReadonlyDeep<Config>,
        mutationOptions?: MutationOptions
      ) => CreateMutationResult<
        Response,
        Errors,
        UndefinedIfNever<Body>,
        unknown
      >;

export type ZodiosAliasHook<Config, QueryOptions, Response> =
  RequiredKeys<Config> extends never
    ? (
        configOptions?: ReadonlyDeep<Config>,
        queryOptions?: QueryOptions
      ) => CreateQueryResult<Response, Errors> & {
        invalidate: () => Promise<void>;
        key: QueryKey;
      }
    : (
        configOptions: ReadonlyDeep<Config>,
        queryOptions?: QueryOptions
      ) => CreateQueryResult<Response, Errors> & {
        invalidate: () => Promise<void>;
        key: QueryKey;
      };

export type ZodiosHooksAliases<Api extends ZodiosEndpointDefinitions> = {
  [Alias in Aliases<Api> as `create${Capitalize<Alias>}`]: ZodiosEndpointDefinitionByAlias<
    Api,
    Alias
  >[number]["method"] extends infer AliasMethod
    ? AliasMethod extends MutationMethod
      ? {
          immutable: ZodiosEndpointDefinitionByAlias<
            Api,
            Alias
          >[number]["immutable"];
          method: AliasMethod;
        } extends { immutable: true; method: "post" }
        ? ZodiosImmutableAliasHook<
            ZodiosBodyByAlias<Api, Alias>,
            ZodiosRequestOptionsByAlias<Api, Alias>,
            Omit<QueryOptionsByAlias<Api, Alias>, "queryKey" | "queryFn">,
            ZodiosResponseByAlias<Api, Alias>
          >
        : ZodiosMutationAliasHook<
            ZodiosBodyByAlias<Api, Alias>,
            ZodiosRequestOptionsByAlias<Api, Alias>,
            MutationOptionsByAlias<Api, Alias>,
            ZodiosResponseByAlias<Api, Alias>
          >
      : ZodiosAliasHook<
          ZodiosRequestOptionsByAlias<Api, Alias>,
          Omit<QueryOptionsByAlias<Api, Alias>, "queryKey" | "queryFn">,
          ZodiosResponseByAlias<Api, Alias>
        >
    : never;
};

export type ZodiosHooksInstance<Api extends ZodiosEndpointDefinitions> =
  ZodiosHooksClass<Api> & ZodiosHooksAliases<Api>;

export type ZodiosHooksConstructor = {
  new <Api extends ZodiosEndpointDefinitions>(
    name: string,
    zodios: ZodiosInstance<Api>
  ): ZodiosHooksInstance<Api>;
};

export const ZodiosHooks = ZodiosHooksClass as ZodiosHooksConstructor;
