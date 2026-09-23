# Angular data loading and HTTP performance: research notes

Scope: Angular 20 to 22. Docs current as fetched: angular.dev showed v22.1.x on 2026-09-21. Method: 3 ctx7 queries (`/websites/angular_dev`) plus page fetches of angular.dev, web.dev, MDN, TanStack. Tags: [V] verified in a fetched page, [U] unverified (from general knowledge, needs checking before it goes into the skill).

Legend for options: Q = quick win (hours, low risk), M = moderate (days), P = planned project (weeks, needs a decision).

## 0. Cross-cutting: how to measure

| Tool | What it shows | Use for |
|---|---|---|
| Chrome DevTools Network, waterfall column | Request start/end, queueing, initiator | Waterfalls, serial requests, duplicate requests |
| Network, Timing tab | Queueing, TTFB, content download | Split server latency from transfer size |
| Network, Size column (transferred vs resource) | Compression effect, "(disk cache)", 304 | Compression and cache checks |
| Network, Protocol column | h2 / h3 / http/1.1 | HTTP/2 check (enable the column via right-click on header) [U: column availability] |
| Server-Timing response header | Backend metrics shown in Network > Timings [V, MDN] | Attributing latency to DB vs app |
| Performance panel / Lighthouse | LCP, long tasks, request chain | End-to-end impact |
| Angular DevTools | Component tree, profiler, change detection. Does not show HTTP [U: no HTTP view found in sources] | Confirm re-render cost after data arrives, not request cost |
| Router events (`NavigationStart`/`NavigationEnd`) with `performance.mark` | Navigation wait including resolvers | Resolver cost |

Automatable safely: static grep for patterns (resolvers, `shareReplay`, `interval(`, `setInterval`, `WebSocket`, `subscribe` in components, `withXhr`, missing `provideHttpClient(withFetch())` on pre-default versions). Needs user: anything that changes when data loads, cache lifetimes, retry policy, API shape.

## 1. Request waterfalls

Pattern: route resolver fetch, then component fetches based on resolver result, then nested fetches (list then per-item detail, N+1). Each step waits on the previous response, so latency adds up.

Measure: Network waterfall, look for staircase where each request starts after the previous ends. Count requests per navigation. Lighthouse "network dependency tree" [U].

Options:
- Q: Start independent requests together (`forkJoin`, `combineLatest`, or several `resource()` in the same component created at construction). Requests that do not depend on each other must not be chained with `switchMap`/`await`.
- Q: Remove a resolver that only forwards a route param to a fetch the component could start itself (see section 2).
- M: Replace N+1 with a batch endpoint or `?ids=`/`include=` expansion. Needs backend change or an existing endpoint.
- M: Move a dependent fetch earlier by deriving what it needs from the route param instead of waiting for a parent response.
- P: Backend-for-frontend or GraphQL query that returns the page's data in one round trip (section 9).

Risk: parallelizing changes error handling (one failure vs many) and ordering assumptions. Effort as above.
Doc: resource `params` reactivity https://angular.dev/guide/signals/resource [V].

## 2. Route resolvers vs component-level loading

Verified [V, https://angular.dev/guide/routing/data-resolvers]:
- Resolvers block navigation: "Users may experience delays between clicking a link and seeing the new route, especially with slow network requests." Guide advises router events and loading indicators.
- Guide advises "Keep resolvers lightweight: Resolvers should fetch essential data only".
- Errors: `withNavigationErrorHandler`, `NavigationError` events, or `catchError` in the resolver.
- `ResolveFn` may return `RedirectCommand`. https://angular.dev/api/router/ResolveFn [V].

Trade-off: resolver = no empty state, but URL and view do not change until data arrives (perceived wait longer, and resolvers of sibling routes may wait for each other [U: exact parent/child resolver ordering not verified]). Component loading = instant navigation with skeleton, data fetch starts only after the component and its lazy chunk are loaded, which can lengthen the total waterfall.

Options:
- Q: Add a navigation progress indicator so blocking is visible.
- Q: Trim resolver to the minimum needed for the first paint. Move secondary data to component resources.
- M: Replace blocking resolver with component-level `httpResource` plus skeleton, when the empty state is acceptable.
- M: Keep data need known early: start the fetch from a `canActivate` or resolver but do not await it (fire-and-forget into a cache) so the component picks it up [U: pattern, not documented as such].
- P: Route-level data strategy (cache layer + prefetch on intent, section 10).

Decision needed from user: is a blank/skeleton state acceptable? SEO/SSR needs? Not automatable.

## 3. resource / httpResource / rxResource

Status: `resource` and `httpResource` marked stable since v22.0 [V, https://angular.dev/api/core/resource, https://angular.dev/api/common/http/httpResource, https://angular.dev/api/core/ResourceLoaderParams]. `rxResource` status not confirmed [U]. In v20 and v21 they were not stable [U: prior status from memory, check release notes]. So skill must branch on the project's Angular version.

Verified behavior:
- Loader reruns whenever the `params` computation yields a new value [V, guide/signals/resource].
- Outstanding load is aborted when `params` changes, `abortSignal` is provided to the loader (pass to `fetch`) [V].
- `resource()` also cancels in-progress loads on component destroy [V, api/core/resource].
- `reload()` re-executes the loader [V].
- Value is kept from the previous state while a dependent resource loads in one documented composition example [V, snapshot section]. General "keep previous value during reload" semantics: [U].
- `httpResource`: "If a request is already pending, the resource cancels the outstanding request before issuing a new one." Goes through `HttpClient`, so interceptors apply [V, guide/http/http-resource].
- `httpResource` accepts `transferCache`, `cache`, `priority`, `keepalive`, `parse`, `defaultValue` [V].
- `resource` SSR reuse: give an `id` and Angular stores the value in `TransferState` and initializes the client resource as resolved [V, guide/signals/resource]. Availability by version: [U].
- No cache inside resource is documented. Two resources with the same params issue two requests [U: absence of documentation, not a positive statement in source]. Params-driven means switching back to a previous param refetches (unless HTTP cache serves it) [U].
- Designed for reads, not mutations [V, api/core/resource].
- `rxResource` stream semantics (multiple emissions, last value wins): [U, not fetched].

Pitfalls (mostly [U], propose to verify by experiment):
- Params object created with a new identity every time can retrigger loads unless `equal` is set. Verify.
- Creating a resource inside a template-invoked function or in a loop creates many fetches.
- `params` returning `undefined` = idle, no request [U for exact wording].

Options:
- Q: Convert one-shot `subscribe` in `ngOnInit` to `httpResource` where version is stable, gaining cancellation on param change and destroy.
- M: Add `HttpClient` `cache` option (browser HTTP cache mode) on stable data, see section 5.
- P: Introduce a shared data layer (section 5).

Measure: Network tab, confirm cancelled requests show as "(canceled)" on fast param changes, count duplicates.

## 4. withFetch, interceptors, dedupe

- Verified [V, https://angular.dev/guide/http/setup]: "By default, HttpClient uses the fetch API to make requests." `withXhr` exists and for SSR the doc says use the fetch default because XHR on the server is deprecated. Since which version fetch became default: [U]. Older projects may still need `provideHttpClient(withFetch())`. Check the project's setup. Fetch limitation: no upload progress events [V].
- Interceptor ordering: functional interceptors via `withInterceptors` have more predictable ordering and are recommended over DI-based [V]. Chained in listed order [V, guide/http/interceptors].
- Interceptors listed as suited for retry with exponential backoff, caching until invalidated, and measuring server response times [V].
- Cost of interceptors: each runs on every request, so avoid heavy sync work, avoid `clone` of large bodies, and avoid interceptors that block on async token refresh without sharing the refresh in flight [U: general reasoning].
- Request options for Fetch: `priority: 'high' | 'low' | 'auto'`, `cache` modes, `keepalive` [V, guide/http/making-requests].
- Dedupe: `HttpClient` does not dedupe identical concurrent requests [U: not stated in fetched sources]. Options: `shareReplay({bufferSize:1, refCount:true})` per key (pitfalls: without `refCount:true` the source stays subscribed and the value stays forever, error caching depends on `resetOnError` config, and never invalidates unless keyed and cleared [U]), an interceptor keeping a `Map<key, Observable>` of in-flight GETs and removing on finalize [U], or a query library.

Options by size:
- Q: Ensure fetch backend (SSR requirement). Set `priority: 'low'` on non-critical calls.
- Q: Replace `shareReplay(1)` without `refCount` by a keyed variant, or remove it if it hides stale data.
- M: In-flight dedupe interceptor for GETs. Needs decision on key (URL + params + selected headers).
- M: Interceptor cache with TTL and invalidate-on-mutation. Needs decision on TTL and invalidation rules.
- P: Adopt a query library (below).

TanStack Query for Angular [V, https://tanstack.com/query/latest/docs/framework/angular/overview]: package `@tanstack/angular-query-experimental`, still marked Experimental, requires Angular 16+, docs warn breaking changes in minor and patch releases so pin the patch version. Provides dedupe, caching, background refresh. Alternatives: a hand-rolled interceptor cache. Skill should present it as a P-size decision with an explicit experimental warning.

## 5. Client caching options

| Option | Effort | Notes |
|---|---|---|
| Browser HTTP cache via correct response headers | Q/M (backend) | Best default. See section 7 |
| `cache: 'force-cache' \| 'no-cache' \| 'only-if-cached'` request option [V] | Q | Per-request Fetch cache mode. Only for stable/config data. `force-cache` ignores freshness |
| Service-level `Map` or signal store with TTL | M | Own invalidation logic |
| Interceptor cache keyed by URL | M | Must skip requests with auth-sensitive variance |
| `shareReplay` | Q | Pitfalls in section 4 |
| TanStack Query | P | Experimental status |

Risk: stale data, cross-user leakage on shared devices, memory growth. User decision: staleness tolerance per endpoint.

## 6. HTTP transfer cache (SSR)

Verified [V, https://angular.dev/best-practices/performance/ssr, https://angular.dev/guide/ssr]:
- Default: caches all `HEAD` and `GET` requests without `Authorization`, `Proxy-Authorization`, or `Cookie` headers, and not sent with `withCredentials` or credentials modes that can send credentials.
- Skipped when request or response has `Cache-Control` `no-store`, `no-cache`, or `private`, and when response has `Set-Cookie`.
- Config: `provideClientHydration(withHttpTransferCacheOptions({ includeHeaders, filter, includePostRequests, includeRequestsWithAuthHeaders }))`.
- Per request: `transferCache: false` or `{ includeHeaders: [...] }`.
- `includePostRequests` only for idempotent reads (e.g. GraphQL queries).
- Docs do not explicitly discuss dedupe or cache key construction [V: absent].
- Not verified: how long the transfer cache lives on the client [U] (believed to be cleared after app becomes stable).

Pitfalls: authenticated apps see no transfer cache benefit by default, so SSR + client both fetch (double fetch). Requests made with `fetch`/`resource` loader directly (not `HttpClient`) are not covered, `resource` needs `id` for `TransferState` [V]. Filter user-specific endpoints.

Options: Q: verify requests aren't doubled in browser Network right after hydration. M: set `filter` and `includeHeaders`. M/P: authenticated SSR strategy (cookie-less public data endpoints, or decide SSR only for public pages). Decision needed from user.

Measure: load SSR page with cache disabled, check Network for XHR/fetch of the same URL that the server already fetched.

## 7. HTTP/2, compression, Cache-Control, ETag, CDN, API latency

Verified [V]:
- web.dev http-cache (https://web.dev/articles/http-cache): versioned URLs `max-age=31536000`, unversioned `no-cache`, ETag and Last-Modified enable `304 Not Modified`. Missing `Cache-Control` does not disable caching (heuristic defaults).
- MDN Caching (https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching): `no-cache` forces revalidation, `no-store` prevents storage, `private` vs shared caches, `Vary`, ETag with `If-None-Match` preferred, example `public, max-age=31536000, immutable` for versioned subresources and `no-cache, private` for main resources.
- stale-while-revalidate: [U] not confirmed in the fetched page excerpts.
- Server-Timing header: `Server-Timing: db;dur=53, app;dur=47.2` shown in Network > Timings [V, MDN Server-Timing].

Unverified (no source fetched): HTTP/2 multiplexing removes need for domain sharding and request bundling, brotli vs gzip size, HTTP/3, CDN edge caching for APIs, API in different region than users. Mark all [U] and fetch from web.dev/MDN before including.

Options: Q: enable compression on JSON (brotli/gzip) at server or CDN, check `content-encoding` response header. Q: add ETag on GET endpoints. M: `Cache-Control` per endpoint with explicit `private`/`max-age`. M: CDN for public GET APIs. P: move API closer to users or add regional edge. Backend/infra work, needs owner decision.

## 8. Pagination, virtual scroll, payload, GraphQL, optimistic UI

- CDK virtual scroll [V, https://material.angular.dev/cdk/scrolling/overview]: `cdk-virtual-scroll-viewport`, `itemSize`, `templateCacheSize`, `renderedRangeStream` and `scrolledIndexChange` can trigger loading more data near the end. Virtual scroll reduces DOM, does not reduce payload by itself.
- Server paging + virtual scroll pitfalls [U]: total count needed for scrollbar size, item placeholders, cancellation of stale page requests, jump-to-index requires page math.
- Over-fetching [U for tools]: `?fields=`/sparse fieldsets, DTO trimming, GraphQL field selection, ETag on lists. Measure with Network Size column: large JSON, unused fields (compare payload keys vs template usage, semi-automatable).
- Optimistic UI [U, no source]: update local state first, roll back on error, reconcile with server result. Needs decision: rollback UX and conflict handling. Not automatable.
- Options: Q: reduce page size or drop unused fields already returned. M: cursor pagination and infinite scroll with `resource` params being the page/cursor. M: virtual scroll for large rendered lists. P: GraphQL or BFF.

## 9. Prefetching data vs router chunk preloading (distinct)

- Router preloading (`withPreloading`, `PreloadAllModules`, custom `PreloadingStrategy`) loads lazy route code only, not data [V, https://angular.dev/guide/routing/customizing-route-behavior via fetch summary. Direct quote: "Preloading strategies eliminate this delay by loading modules before users request them"]. See the existing preloading research in `_architecture/plans/angular-preloading-research.md` for chunk-level detail.
- Data prefetch on intent (hover/focus/viewport of a link) is not a router feature [U]. Approaches: call the service's fetch on `mouseenter`/`focus` with a cache so the destination reuses it [U], `@defer (prefetch on hover)` is for component chunks not data [U, not fetched]. Needs a cache from section 5 to be useful, otherwise it is a wasted duplicate request.
- Options: M: prefetch on hover for top navigation targets with idempotent GETs. P: query-library prefetch. Risk: wasted requests on mobile/metered networks. Decision: which routes, respect `navigator.connection.saveData` [U].

## 10. Polling, WebSockets

Not sourced [U]. Notes to verify:
- Polling cost: each tick is a request, timers keep running on hidden tabs unless paused (`document.visibilityState`, Page Visibility API), overlapping ticks if request slower than interval (use `exhaustMap`/`switchMap`), Angular zone triggers change detection per tick in zone-based apps (check `runOutsideAngular`). SSR: unbounded `interval` can block app stability, so start polling after stable [U].
- Options: Q: pause on hidden tab, stop on destroy. Q: increase interval / backoff when unchanged. M: conditional GET with ETag so polls return 304. P: SSE or WebSocket for push. WebSocket cost: reconnect logic, heartbeat, auth, proxy support, connection limits.
- Measure: Network filtered by XHR/Fetch over 60 seconds, WS frames tab.

## 11. Error handling and retry with backoff

- Verified only that interceptors can do retry with exponential backoff [V]. Angular provides no built-in retry helper [U].
- Guidelines [U]: retry only idempotent requests (GET), only on network errors/5xx/429 (honor `Retry-After`), cap attempts, add jitter, never retry 4xx validation/auth, surface final error state in the UI. RxJS `retry({ count, delay })` supports a delay function [U, verify in RxJS docs].
- Resource-based: `error()` signal and `reload()` [V] give a manual retry button.
- Options: Q: `retry` with capped delay on GET in one interceptor. M: per-endpoint policy, 401 refresh shared in flight. Decision: what to retry silently vs show error.

## Proposed skill content: `references/data-loading.md`

Front matter for the file: applies when `@angular/common/http`, `resource`, resolvers, or SSR present. Start with "detect Angular version, branch on stable status of resource APIs (stable in 22.0, see section 3)".

Outline, each topic with the same 5 fields: How to measure, Options (Q/M/P), Pitfalls, Automatable vs user decision, Links.

1. Triage table: symptom -> topic (staircase waterfall, slow nav, duplicate requests, double fetch after hydration, huge payload, polling load).
2. Measuring toolkit (section 0 table) plus `Server-Timing` guidance.
3. Waterfalls and flattening (section 1).
4. Resolvers vs component loading with a decision matrix (section 2).
5. resource / httpResource / rxResource behavior, version gate, pitfalls flagged as "verify locally" (section 3).
6. HttpClient: fetch backend, interceptor order and cost, priority/cache options, dedupe patterns and `shareReplay` pitfalls (section 4).
7. Client caching ladder from HTTP headers up to query library, with TanStack experimental warning (section 5).
8. SSR transfer cache: defaults, exclusions, double-fetch diagnosis (section 6).
9. Network layer: compression, cache headers, ETag, CDN, Server-Timing (section 7). Mark HTTP/2 and CDN claims after fetching sources.
10. Lists and payload: pagination, virtual scroll, field selection, optimistic UI (section 8).
11. Prefetch data vs chunk preloading, with clear separation (section 9).
12. Polling and sockets (section 10).
13. Retry/backoff policy (section 11).
14. Automation policy: safe = detection (grep for patterns, count subscribe-in-init, find `shareReplay` without `refCount`, find polling), report generation, measurement scripts. Needs user = any change to loading order, caching TTL, retry policy, SSR transfer filter, API shape, optimistic UI, adopting a library.
15. Further reading list (URLs below).

## Source list

- https://angular.dev/guide/http/http-resource [V]
- https://angular.dev/guide/signals/resource [V]
- https://angular.dev/api/core/resource, https://angular.dev/api/common/http/httpResource, https://angular.dev/api/core/ResourceLoaderParams [V] (stable since 22.0)
- https://angular.dev/api/router/ResolveFn, https://angular.dev/guide/routing/data-resolvers [V]
- https://angular.dev/guide/http/setup, /making-requests, /interceptors [V]
- https://angular.dev/best-practices/performance/ssr, https://angular.dev/guide/ssr [V]
- https://angular.dev/guide/routing/customizing-route-behavior [V via summary]
- https://tanstack.com/query/latest/docs/framework/angular/overview [V]
- https://web.dev/articles/http-cache [V]
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching [V]
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Server-Timing [V]
- https://material.angular.dev/cdk/scrolling/overview [V]

## Caveats on method

WebFetch answers come from a small summarizing model, not raw page text. Quotes are the summarizer's rendering, so re-check exact wording before quoting in the skill. `rxResource` page returned only a generic overview, so its status and semantics are unverified. Angular `common/http` source was not read.
