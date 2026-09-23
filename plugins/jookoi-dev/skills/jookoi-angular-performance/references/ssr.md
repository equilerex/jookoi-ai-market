# SSR, prerender, hydration

Covers whether server rendering pays off, per-route render modes, hydration, event replay, incremental hydration, the HTTP transfer cache, mismatch triage, browser-only code, and caching SSR output. Route chunk loading is in `preloading.md`, lazy loading and `@defer` chunking in `loading.md`, request timing and data fetching in `data-loading.md`, server and CDN config in `build-and-deploy.md`. Check the Angular major in `package.json` first. The same snippet is a no-op on 22 and required on 20 or 21.

## Version gate

| Version | Behavior |
|---|---|
| 20 | `withIncrementalHydration()` and `withI18nSupport()` are `@publicApi 20.0`. `RenderMode`, `withRoutes`, `getPrerenderParams`, `PrerenderFallback`, `withAppShell`, `outputMode: static` are documented |
| 21 | Incremental hydration still opt-in via `withIncrementalHydration()` |
| 22 | Incremental hydration is on by default in `provideClientHydration()`. `withIncrementalHydration()` is deprecated. `withNoIncrementalHydration()` is the opt-out |
| 22 docs | `maxResponseBodySize` (1 MB default, NG02825), `includeRequestsWithCredentials`, `includeNonCacheableRequests`, `resource({id})` transfer. Not in the v20 and v21 guides. The exact minor that introduced them is unknown |

Never suggest `withIncrementalHydration()` on 22. Never assume the v22 default on 20 or 21.

## When SSR or prerender pays off

- LCP and FCP on content pages. The browser gets rendered HTML instead of waiting for JS to download, parse, and run.
- SEO. Crawlers limit how much JavaScript they execute, so SSR and prerender both do well.
- Prerender is fastest. Static HTML, CDN cacheable, near-zero per-request server work. Content must be identical for all users.

## When it does not pay

- TTFB gets worse. Server generation takes time before the first byte. web.dev rates TTFB of 0.8 s or less as good.
- Server cost. SSR adds hosting cost that CSR does not have.
- Auth-walled apps. Prerender cannot contain user data, and SSR of a logged-in page has no SEO benefit while adding server cost.
- Complexity. Code cannot touch browser globals and library choice narrows.
- Build time and deploy size grow with every prerendered route from `getPrerenderParams`.
- With the Angular service worker only the first request is server rendered.
- Serverless cold starts are not covered by the docs. Compare cold and warm TTFB before deciding.

| Site type | Default |
|---|---|
| Marketing, docs, blog, catalog | Prerender |
| Public and dynamic (product pages, user content) | `Server` plus CDN caching, or Prerender with `fallback: Server` |
| Auth-walled dashboard | `Client`. SSR only for the public shell and login |
| Mixed | Per-route `RenderMode` |

Ask the user one question when unclear: is the page public and the same for all users? Yes means Prerender. Public but dynamic means SSR plus cache. No means CSR.

## Render modes per route

`ServerRoute[]` in `app.routes.server.ts`, registered with `provideServerRendering(withRoutes(serverRoutes))` in `app.config.server.ts`.

- `RenderMode.Server` renders per request. `RenderMode.Client` is browser only. `RenderMode.Prerender` renders at build time.
- Options: `headers`, `status`. Prerender adds `getPrerenderParams()` (call `inject` before any `await`) and `fallback: PrerenderFallback.Server | Client | None` (default `Server`).
- SSR uses HTTP redirects. Prerender uses `<meta http-equiv="refresh">` soft redirects.
- `outputMode: "static"` in `angular.json` drops the server file for a fully static deploy.
- **A redirect route with a parameter plus a `**` prerender entry fails the build.** Seen on 22.1.6: `{ path: 'learn/:topic', redirectTo: ... }` alongside a `**` `RenderMode.Prerender` entry could not be prerendered. The fix that worked: give the parameterised path its own server route, `{ path: 'learn/:topic', renderMode: RenderMode.Client }` in `app.routes.server.ts`. A failed build writes no output or stats file, see `build-and-deploy.md`. The exact cause in the CLI was not investigated.
- `REQUEST`, `RESPONSE_INIT`, `REQUEST_CONTEXT` are `null` at build, in CSR, in SSG, and during dev route extraction. Code reading cookies from `REQUEST` cannot be prerendered.

| Size | Option | Notes |
|---|---|---|
| Quick | Prerender static routes (`about`, `pricing`). Set the `**` catch-all to `Client` for the logged-in area | Content must be user-independent |
| Moderate | `getPrerenderParams` for detail routes with a `fallback` | Build time and deploy size grow |
| Project | `outputMode: static`, no Node server | Loses SSR for dynamic routes |

Safe to automate: list routes and current mode, flag a missing `**` server route, suggest modes from route names. User decision: choosing any `RenderMode`, dropping SSR, `outputMode: static`.
Measure: `curl -s URL` or view-source to see if real content is in the HTML, build output for prerendered routes, Lighthouse for LCP.

## Hydration

Hydration reuses the server DOM. Without it the app destroys and re-renders the DOM, which can flicker and hurt LCP and CLS. Enable with `provideClientHydration()` in the client providers and the server bootstrap providers (NG0505 if the server lacks it). CLI-generated SSR apps already have it.

- Dev mode prints hydration stats and Angular DevTools shows an overlay marking mismatched components.
- Hydration runs once the app is stable. Pending timers or tasks delay it (NG0506).
- i18n components are skipped unless `withI18nSupport()`. Custom or noop Zone.js is not yet supported.
- Server HTML must not be altered before the client sees it.

### Event replay

`provideClientHydration(withEventReplay())` captures native events (`click`, `mouseover`, `focusin`) before hydration finishes and replays them after. It is on automatically when incremental hydration is on. Test: throttle to Slow 4G with cache disabled, click a button before JS loads, confirm the action still happens. Watch INP in field data.

### Incremental hydration

`@defer` blocks with `hydrate` triggers leave server-rendered parts dehydrated until needed. This allows smaller initial bundles and `@defer` above the fold without a placeholder flash.

- Triggers: `hydrate on idle | viewport | interaction | hover | immediate | timer(N)`, `hydrate when <expr>`, `hydrate never`. `hydrate on idle(500)` passes a timeout to `requestIdleCallback`.
- Example (a code block, so the separator is part of the syntax):
  ```html
  @defer (on idle; hydrate on interaction) { <app-comments /> } @placeholder { <div class="comments-skeleton"></div> }
  ```
- `hydrate` triggers apply only to the initial SSR load. Later client renders use the regular trigger.
- `hydrate when` fires only for the top-most dehydrated block. Nested blocks hydrate parent first. `hydrate never` keeps the subtree static for that page load.
- 20 and 21 need `withIncrementalHydration()`. On 22 it is default and `withNoIncrementalHydration()` opts out. Keep the opt-out in mind as a rollback switch after a 22 upgrade if regressions show up. A plain `@defer` without `hydrate` triggers behaves as before: the server renders only the `@placeholder` and the content loads on the client triggers (user-supplied answer, 2026-09-22, not independently re-checked). Rendering the content on the server needs an explicit `hydrate` trigger.

| Size | Option | Notes |
|---|---|---|
| Quick | Enable hydration if SSR is on without it. Add `withEventReplay()` on 20 and 21 | Mismatch errors will surface |
| Moderate | `@defer` with `hydrate on viewport` or `interaction` for heavy below-the-fold components | Content is static until hydrated |
| Project | Restructure into hydration islands, `hydrate never` for static parts | Needs visual and INP testing |

Safe to automate: detect missing `provideClientHydration` on either bootstrap. User decision: adding `hydrate` triggers, since interactivity changes.

### Rehydration: a real tradeoff

Angular's docs present hydration plus event replay and incremental hydration as the fix for the page being visible before it is interactive. web.dev's `rendering-on-the-web` article is skeptical of rehydration in general and says it is rarely the best option, because the client still downloads and runs the JS that rebuilds state the server already computed. That article is framework-agnostic and predates Angular's event replay, so it does not measure Angular. Treat the two as a tradeoff, not a settled question. Measure INP and TBT on the actual page. For pages with little interactivity, prerender with `hydrate never` regions or a plain CSR shell can be a legitimate choice.

## HTTP transfer cache

On the server `HttpClient` records responses and serializes them into the HTML. The browser reuses them during initial render and stops using the cache once the app is stable.

- Default eligible: `GET` and `HEAD` without `Authorization`, `Proxy-Authorization`, or `Cookie` headers and without credentials.
- Skipped: `Cache-Control` `no-store`, `no-cache`, `private` on request or response, and responses with `Set-Cookie`.
- Options in `withHttpTransferCacheOptions`: `includeHeaders`, `filter`, `includePostRequests`, `includeRequestsWithAuthHeaders`, `includeRequestsWithCredentials`, `includeNonCacheableRequests`. Per request: `transferCache: false | {includeHeaders}`. Off globally: `withNoHttpTransferCache()`. Different server and browser origins: `HTTP_TRANSFER_CACHE_ORIGIN_MAP`.
- `httpResource` reads the transfer cache. `resource({id})` stores its value in `TransferState` when `id` is set and identical on both sides.
- Cached data is serialized into the HTML. A CDN caching that HTML can serve one user's data to another. Do not set `id` on user-specific data.

Duplicate requests after hydration: filter Fetch/XHR in the Network tab after load and compare with the server's outgoing calls. Known causes are an origin mismatch (fix with the origin map), auth or cookie headers excluding the request by design, a fetch inside `afterNextRender` (no server copy), and `POST` reads. Requests made with bare `fetch()` outside `HttpClient` are not documented as covered.

| Size | Option |
|---|---|
| Quick | Confirm duplicates exist. Add the origin map if origins differ. Add `filter` to exclude user-specific endpoints |
| Moderate | Move client-only fetches out of `afterNextRender` into route resolvers or `resource` with `id` |
| Project | Split public and user-specific data so SSR HTML is cacheable |

Safe to automate: reporting duplicate URLs from a trace. User decision: enabling any `include*` widening option, since each is a privacy call. See `data-loading.md` for lifetime details and waterfalls.

## Hydration mismatch triage

Errors NG0500 to NG0507 (node mismatch, missing siblings, missing node, unsupported projection, invalid `ngSkipHydration`, no hydration info from the server, unstable app, HTML altered after SSR).

| Cause | Fix |
|---|---|
| Direct DOM manipulation (`innerHTML`, `appendChild`) | Use templates and Angular APIs. Interim `ngSkipHydration` |
| Invalid nesting (`<table>` without `<tbody>`, `<div>` in `<p>`, `<a>` in `<a>`) | Fix the markup |
| `preserveWhitespaces` differs between server and browser tsconfigs | Keep the default `false`, set only in `tsconfig.app.json` |
| `isPlatformBrowser` in a template changing rendered content | Render the same content, use `afterNextRender` for browser init |
| Libraries that build DOM (D3 charts) | `ngSkipHydration` on the host component |
| Ads or analytics altering the DOM before hydration | Load after hydration via `afterNextRender` |
| CDN or build HTML minification strips whitespace and comments (NG0507) | Disable HTML optimization for Angular HTML |
| Server bootstrap lacks `provideClientHydration()` (NG0505) | Add it |

`ngSkipHydration` (attribute or `host: {ngSkipHydration: 'true'}`) works only on component hosts. On the root component it disables hydration for the whole app. The component and children are destroyed and re-rendered, so its LCP and CLS benefit is lost. Docs call it a last resort. Adding it is a user decision.

## Browser-only code

- `afterNextRender` and `afterEveryRender` run only in the browser. Use them for DOM measurement, third-party init, and `window` access.
- Prefer platform-specific providers (browser implementation in `app.config.ts`, override in `app.config.server.ts`) over `isPlatformBrowser`.
- Use the `DOCUMENT` token instead of the `document` global and the `Meta` service for meta tags.
- `window`, `document`, `navigator`, `location` and some `HTMLElement` properties do not exist on the server.

Safe to automate: grep for bare `window.`, `document.`, `localStorage`, and `isPlatformBrowser` in templates and report. Auto-rewriting is not safe because the right timing depends on intent.

## `@defer` on the server

A plain `@defer` renders only `@placeholder` (or nothing) on the server and its triggers do not fire there. Content inside is absent from server HTML, so verify SEO-critical content with view-source. To render main content on the server use `hydrate` triggers. Barrel-file imports can stop `@defer` from producing a lazy chunk, see `loading.md`.

## Server-side pitfalls

- Top-level provider `useValue` is evaluated once and kept across requests until restart. Use `useFactory` for per-request values. Shared state leaking user data between requests is a security issue, so escalate to the user instead of auto-fixing.
- Timers, intervals, and unresolved promises keep the app unstable. `provideStabilityDebugging` logs pending tasks (added automatically in dev, add manually for a diagnostic build). With Zone.js add `zone.js/plugins/task-tracking` for stacks. Remove both from production.
- `maxResponseBodySize` (1 MB default, v22 docs) limits server fetch responses.
- The docs have a section on preventing SSRF through host validation. Read it before advising on hosting config.

## Caching SSR output

Docs say only that prerendered static files are easy for CDNs and browsers to cache. Prerender: cache aggressively and version on deploy. SSR: cache only when HTML has no user-specific content. Transfer cache and `resource({id})` embed data in the HTML. `ServerRoute.headers` sets `Cache-Control`. CDN HTML minification breaks hydration (NG0507).

| Size | Option |
|---|---|
| Quick | `Cache-Control` via `ServerRoute.headers` on prerendered and public routes |
| Moderate | CDN in front of SSR with short `s-maxage` on confirmed user-independent routes |
| Project | Move mostly static routes to Prerender with on-demand rebuild |

Caching headers on SSR pages are always a user decision. Measure with response headers, TTFB from several locations, and CDN hit ratio.

## Measuring

| What | How |
|---|---|
| TTFB, LCP, FCP, CLS, INP | Lighthouse, PageSpeed Insights, CrUX, `web-vitals` |
| What the server sent | `curl -s URL`, view-source |
| Hydration on | Dev console stats, Angular DevTools overlay |
| Stability delays | `provideStabilityDebugging` plus task-tracking plugin |
| Server render time per route | Angular has no documented built-in metric. Wrap the request handler and emit `Server-Timing` yourself |
| Cold start | Compare first and later request TTFB |

Auditing is safe to automate. Config changes are not.

## Read more

- https://angular.dev/guide/ssr
- https://angular.dev/guide/hydration
- https://angular.dev/guide/incremental-hydration
- https://angular.dev/guide/templates/defer
- https://angular.dev/errors (NG0500 to NG0507, NG02825)
- https://angular.dev/api/ssr/RenderMode
- https://angular.dev/api/platform-browser/withEventReplay
- https://angular.dev/reference/releases
- https://web.dev/articles/ttfb
- https://web.dev/articles/rendering-on-the-web

## Unverified, check before relying

- Stable release versions of event replay (18, 19, or 20) and of incremental hydration (19 or 20).
- Serverless cold start impact, server memory growth specifics, and `stale-while-revalidate` behavior of a CDN in front of SSR.
- Whether `ng new --ssr` adds `withEventReplay()` per version.
- Zoneless plus SSR plus hydration interaction.
- Whether `Vary` or cache-key handling (`Cookie`, query strings, `Accept-Language`) matters for your CDN.
