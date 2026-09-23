# Data loading

Covers request waterfalls, resolvers versus component loading, `resource`, `httpResource`, `rxResource`, the `HttpClient` backend, dedupe, `shareReplay` pitfalls, the SSR transfer cache lifetime, and how data prefetching differs from router chunk preloading. Chunk preloading is in `preloading.md`, lazy chunk cost in `loading.md`, render modes and hydration in `ssr.md`, runtime cost after data arrives in `runtime.md`, HTTP headers and CDN in `build-and-deploy.md`. Check the Angular major in `package.json` first because the resource APIs and the fetch default differ by version.

## Version gate

| Topic | 20 | 21 | 22 |
|---|---|---|---|
| `resource`, `httpResource`, `rxResource` | Not stable | `@experimental` | `@publicApi 22.0` |
| Default `HttpClient` backend | XHR, add `withFetch()` | XHR, add `withFetch()` | Fetch. `withFetch()` deprecated, `withXhr()` available |

XHR on the server is deprecated, with removal intended in Angular 23. Fetch has no upload progress events. SSR needs the fetch backend, so on 20 and 21 confirm `provideHttpClient(withFetch())`. On 20 the status of the resource APIs before 21 is unchecked, so warn about API churn on anything below 22.

## How to measure

| Tool | Use for |
|---|---|
| DevTools Network waterfall | Staircases, serial requests, duplicates, "(canceled)" on fast param changes |
| Network Timing tab | Queueing versus TTFB versus download |
| Size column (transferred versus resource) | Compression and cache effect |
| `Server-Timing` response header | Backend latency shown in Network Timings |
| Router events with `performance.mark` | Navigation wait including resolvers |
| Lighthouse and Performance panel | End-to-end LCP and long tasks |

Safe to automate: grep for resolvers, `shareReplay`, `interval(`, `setInterval`, `subscribe` in `ngOnInit`, `withXhr`, and a missing `withFetch()` on 20 or 21. Changes to load order, cache lifetimes, retry policy, or API shape are user decisions.

## Request waterfalls

Pattern: a resolver fetch, then a component fetch that depends on it, then per-item detail calls (N+1). Each step waits for the previous response, so latencies add.

| Size | Option |
|---|---|
| Quick | Start independent requests together (`forkJoin`, `combineLatest`, or several resources created at construction). Remove a resolver that only forwards a route param to a fetch the component could start. Set `priority: 'low'` on non-critical calls |
| Moderate | Replace N+1 with a batch endpoint or an `ids` or `include` expansion. Derive a dependent fetch's inputs from the route param instead of waiting on a parent response |
| Project | Backend-for-frontend or GraphQL returning the page's data in one round trip |

Pitfall: parallelizing changes error handling (one failure versus many) and ordering assumptions. Chained `switchMap` or `await` on independent calls is the usual cause.

## Resolvers versus component loading

Resolvers block navigation. The docs note users may see a delay between clicking a link and seeing the new route on slow requests, and advise keeping resolvers lightweight (essential data only) with loading indicators via router events. Errors go through `withNavigationErrorHandler`, `NavigationError` events, or `catchError`. A `ResolveFn` may return `RedirectCommand`.

| | Resolver | Component loading |
|---|---|---|
| Empty state on arrival | None | Skeleton needed |
| Perceived navigation | URL and view wait for data | Instant, then data |
| Waterfall | Data starts before the component renders | Data starts after the component and its lazy chunk load, which can lengthen the chain |

| Size | Option |
|---|---|
| Quick | Add a navigation progress indicator. Trim the resolver to first-paint essentials |
| Moderate | Replace a blocking resolver with component-level `httpResource` plus a skeleton |
| Project | A route-level data strategy with a cache layer and prefetch on intent |

Ask the user: is a blank or skeleton state acceptable, and is SSR needed for this route? Not automatable.

## `resource`, `httpResource`, `rxResource`

- The loader reruns whenever the `params` computation yields a new value. The outstanding load is aborted on a params change and `abortSignal` is passed to the loader (hand it to `fetch`). `resource()` also cancels on component destroy. `reload()` re-executes the loader.
- `httpResource` cancels a pending request before issuing a new one, runs through `HttpClient` so interceptors apply, and accepts `transferCache`, `cache`, `priority`, `keepalive`, `parse`, `defaultValue`.
- `rxResource` takes `stream`. Each emission updates the value in place. Completing without an emission throws NG0991, for example after `catchError(() => EMPTY)`. A new params value unsubscribes the previous stream. It needs an injection context or an `injector`.
- Resources are for reads, not mutations. `error()` and `reload()` give a manual retry.
- Dedupe is not documented. No cache or dedupe code was found in the resource sources, so two instances with equal params should be assumed to send two requests. Verify in the Network tab.

| Size | Option |
|---|---|
| Quick | On 22, convert one-shot `subscribe` in `ngOnInit` to `httpResource` for cancellation on param change and destroy |
| Moderate | Use the request `cache` option (Fetch cache mode) for stable data |
| Project | A shared data layer (below) |

## `HttpClient` details

- Functional interceptors via `withInterceptors` run in the listed order and are recommended over DI-based ones. Documented uses include retry with exponential backoff, caching until invalidated, and timing server responses.
- Request options on the fetch backend: `priority: 'high' | 'low' | 'auto'`, `cache` modes, `keepalive`.
- Dedupe of identical concurrent requests is not documented and no dedupe code was found in `client.ts`, `interceptor.ts`, or `transfer_cache.ts`. Do not assume it either way. Measure.

### `shareReplay` pitfalls

`shareReplay` is `share` with a `ReplaySubject` connector, `resetOnError: true`, `resetOnComplete: false`, and `resetOnRefCountZero` equal to `refCount`, which defaults to `false`.

- With the default the source is never unsubscribed when subscribers drop to zero. On an infinite source this leaks the subscription.
- A completed source stays cached forever, even with `refCount: true`, because completion is not reset. An errored source can be retried on the next subscribe.
- Nothing invalidates it. A module-level `shareReplay(1)` on a GET is a permanent cache until reload.
- For streams that must stop when unobserved use `shareReplay({bufferSize: 1, refCount: true})`. This recommendation is derived from the operator source, not quoted from docs.

Safe to automate: find `shareReplay(1)` without an options object and report. Choosing the fix (keyed cache, remove, TTL) is a user decision because it can change data freshness.

### Caching ladder

| Size | Option | Decision needed |
|---|---|---|
| Quick | `shareReplay` with `refCount: true`, or remove one that hides stale data | Staleness tolerance |
| Quick | Fetch `cache` mode on stable config endpoints | `force-cache` ignores freshness |
| Moderate | In-flight GET dedupe or TTL cache in an interceptor | Key (URL, params, selected headers) and invalidation on mutation |
| Project | A query library. TanStack Query for Angular (`@tanstack/angular-query-experimental`) is still marked Experimental, needs Angular 16+, and the docs warn of breaking changes in minor and patch releases, so pin the patch version | Adoption and lock-in |

Risks: stale data, cross-user leakage on shared devices, memory growth. Not automatable.

## SSR transfer cache and data

Full option list is in `ssr.md`. Data-loading points:

- The client uses the transfer cache only until the app is first stable. The implementation sets the cache inactive after `appRef.whenStable()`. Requests made after that go to the network even if the server made them.
- Default eligible: `GET` and `HEAD` without `Authorization`, `Proxy-Authorization`, `Cookie` headers and without credentials. Skipped for `Cache-Control` `no-store`, `no-cache`, `private` and for `Set-Cookie` responses.
- Authenticated apps therefore see no benefit by default and fetch twice, once on the server and once in the browser.
- `httpResource` reads the transfer cache. `resource` needs `id` for `TransferState`, identical on both sides, never on user-specific data.
- Docs do not discuss cache key construction. Whether identical concurrent requests dedupe is not documented.

Diagnose: load the SSR page with cache disabled and look for a Fetch/XHR to a URL the server already requested. Moderate: set `filter` and `includeHeaders`. Project: an authenticated SSR strategy using public data endpoints, or SSR only for public pages. User decision.

## Prefetching data versus preloading chunks

These are different mechanisms. Router preloading (`withPreloading`, `PreloadAllModules`, a custom `PreloadingStrategy`) loads lazy route code and never runs resolvers or fetches data. See `preloading.md`. `@defer` `prefetch` triggers are also code, per template block. The router has no documented data prefetch. Prefetching data on hover or focus needs your own call into a service, and it only helps if the destination reuses the result from a cache. Without a cache it is a wasted duplicate request.

| Size | Option |
|---|---|
| Moderate | Prefetch idempotent GETs for top navigation targets on hover or focus, backed by a cache |
| Project | Query library prefetch |

Risk: wasted requests on metered networks. Ask the user which routes qualify. Not automatable.

## Network layer

- Versioned URLs can use `max-age=31536000`. Unversioned resources use `no-cache` with `ETag` or `Last-Modified` so revalidation returns `304`. Missing `Cache-Control` does not disable caching because browsers apply heuristic defaults.
- `no-cache` forces revalidation, `no-store` prevents storage, `private` excludes shared caches, and `Vary` affects cache keys.
- Quick: compression on JSON and an `ETag` on GET endpoints. Moderate: explicit per-endpoint `Cache-Control` with `private` or `max-age`. Backend work with an owner decision. More in `build-and-deploy.md`.

## Lists and payload

CDK virtual scroll (`cdk-virtual-scroll-viewport`, `itemSize`) reduces DOM, not payload. `scrolledIndexChange` and `renderedRangeStream` can trigger loading more near the end. Quick: shrink page size or drop unused fields already returned (compare payload keys to template use, semi-automatable). Moderate: cursor pagination with the cursor as a `resource` param, virtual scroll for large lists. Project: GraphQL or a BFF.

## Read more

- https://angular.dev/guide/signals/resource
- https://angular.dev/guide/http/http-resource
- https://angular.dev/guide/http/setup
- https://angular.dev/guide/http/making-requests
- https://angular.dev/guide/http/interceptors
- https://angular.dev/guide/routing/data-resolvers
- https://angular.dev/api/router/ResolveFn
- https://angular.dev/best-practices/performance/ssr
- https://tanstack.com/query/latest/docs/framework/angular/overview
- https://web.dev/articles/http-cache
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Server-Timing
- https://material.angular.dev/cdk/scrolling/overview

## Unverified, check before relying

- Whether `HttpClient` or resources dedupe concurrent identical requests. Only absence in source was checked.
- Behavior when switching `params` back to a previous value (refetch versus reuse) and whether a resource keeps its previous value during reload in general.
- Params objects with unstable identity retriggering loads unless `equal` is set.
- Parent and child resolver ordering and whether sibling resolvers wait on each other.
- Stability of `resource` on 20 and 19 beyond "not stable".
- HTTP/2 multiplexing, brotli versus gzip, HTTP/3, and CDN edge caching of APIs.
- Optimistic UI, polling and WebSocket costs, and retry with backoff guidance, all unsourced.
