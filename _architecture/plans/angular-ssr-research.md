# Angular SSR, SSG, hydration: research notes (Angular 20-22)

Purpose: source material for a general-knowledge Angular performance advisor skill (`references/ssr.md`).
Research date: 2026-09-21. Latest docs at angular.dev were built at v22.1.7 (footer of the fetched pages).

## Sources and method

| Tag | Source | Used for |
|---|---|---|
| [A-latest] | https://angular.dev/guide/ssr, /guide/hydration, /guide/incremental-hydration, /guide/templates/defer, /guide/signals/resource (fetched as `https://angular.dev/assets/context/llms-full.txt`, v22.1.x) | Everything not marked otherwise |
| [A-v21] | https://v21.angular.dev/guide/ssr, `.../assets/context/llms-full.txt` | Version diffs |
| [A-v20] | https://v20.angular.dev/guide/ssr | Version diffs (only keyword presence checked, not full read) |
| [SRC22] | https://raw.githubusercontent.com/angular/angular/22.1.x/packages/platform-browser/src/hydration.ts and `packages/common/http/src/transfer_cache.ts` | Defaults and deprecations |
| [ERR] | https://angular.dev/errors/NG0500 ... NG0507 | Hydration errors |
| [WEB] | https://web.dev/articles/ttfb, /articles/rendering-on-the-web, /articles/stale-while-revalidate | Metrics thresholds, tradeoffs |
| [RELEASES] | https://angular.dev/reference/releases | Version dates and support |

ctx7 was used twice (`library`, `docs` for `/websites/angular_dev`); it returned 4 snippets only, so the guide pages were fetched directly instead. Router source was not needed.

Version facts [RELEASES]: v22.0 released 2026-06-03 (Active), v21 2025-11-19 (LTS), v20 2025-05-28 (LTS until 2026-11-28). v19 and older are unsupported.

## 0. Cheat sheet: what changed by version

| Version | Change | Source / status |
|---|---|---|
| 17 | `provideClientHydration()` public (`@publicApi 17.0`) | [SRC22] |
| 18 | Event replay (`withEventReplay`) introduced; docs say "Starting from v18" | [A-latest] (stable status in 18/19 unverified; `withEventReplay` shows `@publicApi 20.0` in source, so treat 20 as the stable release) |
| 19 | Incremental hydration and `hydrate` triggers: version of introduction not confirmed in fetched sources | unverified (only that `withIncrementalHydration` carries `@publicApi 20.0` in source) |
| 20 | `withIncrementalHydration()` and `withI18nSupport()` stable (`@publicApi 20.0`); `@angular/ssr` route config with `RenderMode` per route, `withRoutes`, `getPrerenderParams`, `PrerenderFallback`, `withAppShell`, `outputMode: static`, `REQUEST`/`RESPONSE_INIT`/`REQUEST_CONTEXT` all documented in the v20 guide | [SRC22], [A-v20] keyword presence |
| 21 | Incremental hydration still opt-in via `withIncrementalHydration()`; `provideStabilityDebugging` documented | [A-v21] |
| 22 | Incremental hydration ON by default in `provideClientHydration()`; `withIncrementalHydration()` deprecated; new `withNoIncrementalHydration()` (`@publicApi 22.0`) | [SRC22], [A-latest] |
| 22 | Docs add `maxResponseBodySize` (1 MB default, NG02825) on `provideServerRendering`, `includeRequestsWithCredentials`, `includeNonCacheableRequests` transfer-cache options, `resource({id})` TransferState caching | Present in [A-latest] and `includeNonCacheableRequests` in [SRC22]; absent from the v20 and v21 guides by keyword search. Exact introducing minor (22.0 vs 22.x) unverified |
| 22 | Dev mode: `provideClientHydration` adds `provideStabilityDebugging()` automatically | [SRC22] shows it; docs say "provided by default in dev mode" |

Implication for the skill: always detect the Angular major from `package.json` before recommending; the same code sample can be a no-op (v22 default) or required (v20/v21).

## 1. When SSR / prerender helps and when it does not

### Helps
- LCP and FCP on content pages: server sends rendered HTML, browser does not wait for JS download/parse/execute. [A-latest] "Server-side rendering offers faster page loads than client-side rendering". Client-side rendering "generally has worse performance ... must download, parse, and execute your page's JavaScript before the user can see any rendered content".
- SEO: "search crawlers have limits to how much JavaScript they execute" [A-latest]; SSR and prerender both "generally have excellent SEO".
- Prerender (SSG) is the fastest: static HTML, CDN-cacheable, "extremely little overhead per server request" [A-latest]. Requires page content to be identical for all users.

### Hurts or does not pay
- TTFB: "generating pages on the server takes time, which can increase your page's TTFB" [WEB rendering-on-the-web]. Good TTFB is 0.8 s or less, poor is above 1.8 s [WEB ttfb] (the 1.8 s upper bound was truncated in extraction; 0.8 s confirmed).
- Server cost: SSR "may increase server hosting costs" [A-latest]. CSR needs no server work beyond static files.
- User-specific pages: prerender cannot contain user data [A-latest]. SSR of auth-walled pages gives no SEO benefit and adds server cost. Whether it improves LCP there depends on data-fetch latency on the server; unverified as a general claim.
- Complexity: code must not depend on browser globals; library selection limited [A-latest].
- Build time and deploy size grow with many prerendered routes (`getPrerenderParams`) [A-latest].
- Service worker: with Angular service worker the first request is server rendered, later ones are handled by the service worker and rendered client-side [A-latest].
- Uncanny valley: page is visible before it is interactive. Mitigated by event replay and incremental hydration (section 3). [WEB rendering-on-the-web] discusses rehydration costs and says rehydration "is rarely the best option" in general; that article is framework-agnostic and predates Angular's event replay, so treat as background only.
- Cold starts on serverless: not covered in the fetched Angular docs. Unverified. Recommend only as "measure TTFB on cold vs warm" without asserting numbers.

### Decision guide (proposed)
| Site type | Suggested default |
|---|---|
| Marketing, docs, blog, catalog (same for everyone) | Prerender |
| Public but frequently changing or many params (product pages, user-generated content) | SSR (`Server`) + CDN caching; or Prerender with `fallback: Server` |
| Auth-walled dashboard | Client (CSR); SSR only for public shell/login |
| Mixed | Per-route `RenderMode` (section 2) |

## 2. RenderMode per route

- How to measure: view-source / `curl` the URL to see whether HTML has content; Lighthouse or DevTools Performance for LCP; `Server-Timing` (see section 11); build output lists prerendered routes.
- API: `ServerRoute[]` in `app.routes.server.ts`, registered with `provideServerRendering(withRoutes(serverRoutes))` in `app.config.server.ts`. [A-latest, also present in A-v20/A-v21]
- Modes: `RenderMode.Server` (per request), `RenderMode.Client` (browser only, default Angular behavior), `RenderMode.Prerender` (build time).
- Per-route options: `headers`, `status`; Prerender adds `getPrerenderParams()` (build time, must call `inject` synchronously before any `await`) and `fallback: PrerenderFallback.Server | Client | None` (default Server). `withAppShell(Component)` for CSR routes with an app shell.
- Redirects: SSR uses HTTP redirects; prerender uses `<meta http-equiv="refresh">` soft redirects [A-latest]. Soft redirects are weaker for SEO; that consequence is my inference, unverified.
- `outputMode: "static"` in `angular.json` build options: no server file, fully static deploy [A-latest]. Default (server output) prerenders and also emits a server.
- Request tokens: `REQUEST`, `RESPONSE_INIT`, `REQUEST_CONTEXT` are `null` at build, in CSR, in SSG, and during dev route extraction [A-latest]. Code that reads cookies from `REQUEST` cannot be prerendered.

| Size | Option | Effort | Risk |
|---|---|---|---|
| Quick win | Prerender static routes (`about`, `pricing`), keep the rest as-is | S | Low; content must be user-independent |
| Quick win | `**` catch-all set to `Client` for logged-in area | S | Low |
| Moderate | `getPrerenderParams` for detail routes with `fallback: Client` or `Server` | M | Build time and deploy size grow |
| Planned | Move to `outputMode: static` and drop the Node server | L | Loses SSR for dynamic routes |

Automate safely: listing routes and suggesting a mode from route names is safe as a suggestion. Changing `RenderMode` is a user decision (behavior, cost, and data privacy change).

Docs: https://angular.dev/guide/ssr (Server routing), https://angular.dev/api/ssr/RenderMode

## 3. Hydration, event replay, incremental hydration

### Hydration
- Reuses server DOM instead of destroying and re-creating it; without hydration an SSR app "will destroy and re-render the application's DOM", which can flicker and hurt LCP/CLS [A-latest].
- Enable: `provideClientHydration()` in client providers AND in the server bootstrap providers (NG0505 if server does not include it). CLI-generated SSR already has it.
- Confirm in dev: console prints hydration stats; Angular DevTools shows hydration overlay and highlights the mismatching component [A-latest].
- Hydration and post-hydration cleanup run only once the app is stable (see section 9).
- Constraint: server HTML must not be altered between server and client; i18n components are skipped unless `withI18nSupport()`; custom/noop Zone.js "not yet supported" [A-latest].

### Event replay
- Captures user events before hydration completes and replays them after [A-latest]. Enable with `provideClientHydration(withEventReplay())`. Events supported: native browser events (`click`, `mouseover`, `focusin`).
- Automatically on when incremental hydration is on [A-latest]. Whether `ng new --ssr` adds it explicitly for 19/20/21: unverified.
- Measure: click a button before the JS loads (DevTools network throttling to Slow 4G, disable cache) and check the action still happens. INP in field data.

### Incremental hydration (`@defer` with `hydrate` triggers)
- Leaves parts of a server-rendered page dehydrated until needed; enables smaller initial bundles and allows `@defer` above the fold without placeholder flash [A-latest].
- Triggers: `hydrate on idle | viewport | interaction | hover | immediate | timer(N)`, `hydrate when <expr>`, `hydrate never`. Multiple separated with `;`. `hydrate on idle(500)` passes a timeout to `requestIdleCallback`.
- Combined form: `@defer (on idle; hydrate on interaction)`: `hydrate` triggers apply only to the initial SSR load; later client-side renders use the regular trigger.
- Rules: `hydrate when` only fires for the top-most dehydrated block; nested blocks hydrate parent-first; `hydrate never` makes the whole subtree static for that page load. [A-latest]
- Enabling: v20/v21 `provideClientHydration(withIncrementalHydration())`; v22 default on, opt out with `withNoIncrementalHydration()`. [A-v21], [SRC22]
- Opt-out reason (proposed, not from docs): a v22 upgrade turns the feature on for existing apps; if `@defer` blocks with `hydrate` triggers are absent, effect should be nil, but this is unverified. Keep `withNoIncrementalHydration()` as the rollback switch if regressions appear after upgrading.

| Size | Option | Effort | Risk |
|---|---|---|---|
| Quick win | Enable hydration if SSR is on but hydration is missing (and `withEventReplay()` on v20/v21) | S | Mismatch errors surface (section 5) |
| Moderate | Wrap below-the-fold heavy components in `@defer (hydrate on viewport)` or `hydrate on interaction` | M | Content that must be interactive immediately; UI shows static until hydrated |
| Planned | Restructure page into hydration islands, use `hydrate never` for static content | L | Nested defer ordering; needs visual and INP testing |

Automate safely: detect missing `provideClientHydration` in server config (NG0505 precondition). Adding `hydrate` triggers is a user decision (changes interactivity).

Docs: https://angular.dev/guide/hydration, https://angular.dev/guide/incremental-hydration, https://angular.dev/api/platform-browser/withEventReplay, https://angular.dev/api/platform-browser/withNoIncrementalHydration

## 4. HTTP transfer cache and duplicate requests

- Behavior [A-latest]: on the server `HttpClient` records responses, serializes them into the HTML, and the browser reuses them during initial render; the browser stops using the cache once the app is stable.
- Defaults: `GET`/`HEAD` only; skipped when request has `Authorization`, `Proxy-Authorization`, `Cookie` headers, `withCredentials`/credentials modes; skipped for `Cache-Control: no-store|no-cache|private` (request or response) or fetch `cache: no-store|no-cache`; responses with `Set-Cookie` are skipped. The credentials and non-cacheable skipping are documented only in the latest docs; older versions unverified.
- Options in `withHttpTransferCacheOptions`: `includeHeaders` (none by default), `filter`, `includePostRequests`, `includeRequestsWithAuthHeaders`, `includeRequestsWithCredentials`, `includeNonCacheableRequests`. Per-request: `transferCache: false | {includeHeaders}`. Global off: `withNoHttpTransferCache()`. Origin mapping when server and client call different origins: `HTTP_TRANSFER_CACHE_ORIGIN_MAP`. Combining `withNoHttpTransferCache()` with `withHttpTransferCacheOptions()` throws a configuration error [SRC22].
- Security: docs warn not to include sensitive headers; cached data is serialized into HTML, so caching SSR output at a CDN can leak user-specific data if such requests were transferred. Same warning for `resource({id})`. [A-latest]
- `resource()` with `id` (v22 docs) transfers the resolved value via `TransferState`. `httpResource` transfer behavior: unverified.
- Duplicate requests: measure by DevTools Network, filter Fetch/XHR after load, compare with the server's outgoing requests. Common causes: origin differs between server (internal URL) and browser (public URL) so the cache key misses (fix: `HTTP_TRANSFER_CACHE_ORIGIN_MAP`); auth/cookie headers exclude the request (by design); request made in `afterNextRender` (browser only, so no server copy); `POST` reads; non-`HttpClient` fetch calls (`fetch()` direct is not covered, inferred from "HttpClient caches", unverified).
- Response size limit: `maxResponseBodySize` default 1 MB on the server fetch backend (v22 docs, NG02825). Docs say keep it small; also the fetch integrity check reads the whole body regardless [A-latest].

| Size | Option | Effort | Risk |
|---|---|---|---|
| Quick win | Confirm duplicates exist; add origin map if server/client origins differ | S | Low |
| Quick win | Add `filter` to exclude user-specific endpoints | S | Low, protects privacy |
| Moderate | Move client-only fetches out of `afterNextRender` into route resolvers or `resource` with `id` | M | Changes data timing |
| Planned | Redesign public vs. user-specific data split so SSR HTML is cacheable | L | Architecture change |

Automate safely: reporting duplicate URLs from a trace. Enabling `includePostRequests`, `includeRequestsWithAuthHeaders`, `includeRequestsWithCredentials`, or `includeNonCacheableRequests` is a user decision (privacy).

Docs: https://angular.dev/guide/ssr#caching-data-when-using-httpclient, https://angular.dev/api/common/http/HttpTransferCacheOptions

## 5. Hydration mismatch: causes and fixes

Errors [ERR] (https://angular.dev/errors/NG0500 through NG0507): NG0500 node mismatch, NG0501 missing siblings, NG0502 missing node, NG0503 unsupported projection of DOM nodes, NG0504 `ngSkipHydration` on invalid node, NG0505 no hydration info in server response, NG0506 application remains unstable, NG0507 HTML altered after SSR.

| Cause | Fix | Source |
|---|---|---|
| Direct DOM manipulation (`innerHTML`, `appendChild`, `document.querySelector` then mutate) | Refactor to Angular templates/APIs; interim: `ngSkipHydration` on the component | [A-latest] |
| Invalid HTML nesting (`<table>` without `<tbody>`, `<div>` in `<p>`, `<a>` in `<a>`) | Fix markup; always declare `<tbody>` | [A-latest] |
| `preserveWhitespaces` differs between server and browser tsconfigs | Keep default `false`; set only in `tsconfig.app.json` so server inherits | [A-latest] |
| `@if (isPlatformBrowser(...))` rendering different content on each side | Render the same content; use `afterNextRender` for browser-only init | [A-latest] |
| Third-party libs that build DOM (D3 charts) | `ngSkipHydration` on the host component | [A-latest] |
| Third-party scripts (ads, analytics) that alter DOM before hydration | Defer them until after hydration (`afterNextRender`) | [A-latest] |
| CDN/HTML post-processing strips whitespace and comment nodes (NG0507) | Turn off HTML minification/optimization for the Angular HTML at the CDN and in build steps | [ERR NG0507] |
| Server bootstrap lacks `provideClientHydration()` (NG0505) | Add it to server providers | [ERR NG0505] |
| i18n blocks | Skipped by default; add `withI18nSupport()` | [A-latest] |
| Custom/noop Zone.js | Not supported; timing of stable event | [A-latest] |

`ngSkipHydration`: attribute or host binding `host: {ngSkipHydration: 'true'}`; only valid on component host nodes; on the root component it disables hydration for the whole app. Docs call it a last resort. Cost: the component and children are destroyed and re-rendered, so its LCP/CLS benefit is lost.

Measure: dev-mode console errors (NG05xx), Angular DevTools hydration overlay; field: CLS and LCP element flicker. Effort S to M per component. Risk: skip-hydration hides bugs; prefer fixing.

Docs: https://angular.dev/guide/hydration#errors, https://angular.dev/errors

## 6. Browser-only code: `afterNextRender`, `isPlatformBrowser`, DI

- `afterNextRender` / `afterEveryRender` run only in the browser, skipped on the server [A-latest]. Use for DOM measurement, third-party init, `window` access.
- Preferred over `isPlatformBrowser`/`isPlatformServer`: platform-specific providers (browser implementation in `app.config.ts`, server override in `app.config.server.ts`) [A-latest].
- Use the `DOCUMENT` token instead of the `document` global; use `Meta` service for meta tags [A-latest].
- Do not use `isPlatformBrowser` in a template conditional to change rendered content: hydration mismatch and layout shift [A-latest].
- `window`, `document`, `navigator`, `location`, and some `HTMLElement` properties are unavailable on the server [A-latest].
- `localStorage`/`sessionStorage`: not mentioned in the fetched text; they are browser globals so the same rule applies (inference, unverified against docs).
- Effort: S per usage. Automate safely: grep for bare `window.`/`document.`/`localStorage` in files reachable from server bundle and report them. Auto-rewrite is not safe (semantics depend on when the code should run).

Docs: https://angular.dev/guide/ssr#authoring-server-compatible-components, https://angular.dev/api/core/afterNextRender

## 7. `@defer` on the server

- Default in SSR and SSG: the server renders `@placeholder` (or nothing) and triggers do not fire; on the client the placeholder is hydrated and triggers run [A-latest defer guide].
- To render the main content on the server, use incremental hydration with `hydrate` triggers on the block [A-latest].
- Consequence for SEO: content inside a plain `@defer` is absent from server HTML (inference from the rule above; state as "verify with view-source").
- Related pitfall: barrel-file imports can stop `@defer` from producing a lazy chunk [A-latest defer guide].
- Measure: view-source to see what the server rendered; build output for lazy chunk.

| Size | Option | Effort | Risk |
|---|---|---|---|
| Quick win | Check important SEO content is not inside a plain `@defer` | S | None |
| Moderate | Add `hydrate on ...` so content is in HTML but its JS loads lazily | M | Interactivity delay until trigger |
| Planned | Rework above-the-fold layout to use incremental hydration | L | Needs visual regression testing |

Docs: https://angular.dev/guide/templates/defer

## 8. SSR-specific pitfalls

| Pitfall | What docs say | Fix | Status |
|---|---|---|---|
| Provider state shared across requests | Top-level provider `useValue` is evaluated once and kept across requests until server restart; use `useFactory` for per-request values [A-latest] | Use factory providers; do not store per-user data in module-level variables or root singletons that are not request-scoped | Verified |
| Timers, intervals, unresolved promises keep app unstable | Hydration and cleanup wait for stability; `provideStabilityDebugging` logs pending `PendingTasks`; with Zone.js add `zone.js/plugins/task-tracking` for stack traces (NG0506) [A-latest] | Clear timers; run polling in `afterNextRender`; avoid long `setTimeout` on server | Verified for hydration; effect on server response time (request held open until stable) is my inference, unverified |
| Memory growth across requests | Not covered in fetched docs | Would need a heap snapshot on the server | Unverified: do not assert specifics |
| Third-party scripts | Scripts that alter DOM before hydration cause mismatches; delay with `afterNextRender` [A-latest] | Load after hydration | Verified |
| Request forgery | Docs section "Preventing Server-Side Request Forgery (SSRF)" exists in `llms-full.txt` (host validation) | Configure allowed hosts per docs | Section located, contents not read here; flag for follow-up |
| Large responses | `maxResponseBodySize` 1 MB default (v22 docs) | Keep small | Verified (v22 docs) |
| Cookies, `REQUEST` in prerender | Tokens are null in SSG/CSR/build | Guard with null checks | Verified |

`provideStabilityDebugging`: added automatically in dev by `provideClientHydration` [SRC22]; must be added manually for production bundles. Docs say do not leave it (or the task-tracking plugin) in production builds.

Measure: server render time per route (section 11), server RSS memory over N requests (load test), `curl` time. Effort M. Risk: shared-state leaks are security-relevant (user A data in user B page), so escalate to the user rather than auto-fix.

Docs: https://angular.dev/guide/ssr#setting-providers-on-the-server, https://angular.dev/errors/NG0506, https://angular.dev/guide/hydration#hydration-timing-and-application-stability

## 9. Caching SSR output (CDN, stale-while-revalidate)

Angular docs (fetched) say only that prerendered static files are easily cached by CDNs, browsers, and intermediate layers [A-latest]. SSR page caching guidance is not in the fetched Angular docs.

- Prerender: cache aggressively; version HTML on deploy.
- SSR: cache only if the HTML has no user-specific content. Transfer cache and `resource({id})` embed data in HTML, so a cached page carries that data to other users [A-latest warning].
- `stale-while-revalidate`: [WEB stale-while-revalidate] describes it as an HTTP `Cache-Control` extension letting a cache serve stale content while revalidating in the background, and notes browser support. Applying it to a CDN in front of Angular SSR: CDN behavior is vendor specific, unverified here; verify with vendor docs.
- Interaction with hydration: CDN HTML minification breaks hydration (NG0507).
- Cache-key concerns (`Vary: Cookie`, query strings, Accept-Language): unverified, mention as things to check.
- How to measure: response headers (`Age`, `X-Cache`, vendor specific), TTFB from multiple locations, cache hit ratio in CDN dashboard.

| Size | Option | Effort | Risk |
|---|---|---|---|
| Quick win | Add `Cache-Control` via `ServerRoute.headers` for prerendered/public routes | S | Stale content until expiry |
| Moderate | CDN in front of SSR with short `s-maxage` + `stale-while-revalidate` on public routes | M | User data leakage if page is personalised; must confirm routes are user-independent |
| Planned | Move mostly-static routes to Prerender + on-demand rebuild | L | Build pipeline change |

The `headers` option in `ServerRoute` is documented [A-latest]; use for `Cache-Control`. Automate safely: nothing; caching headers on SSR pages are a user decision.

Docs: https://angular.dev/guide/ssr#setting-headers-and-status-codes, https://web.dev/articles/stale-while-revalidate

## 10. Version-specific notes (17-22)

See section 0. Extra points:
- Angular 20/21/22 all support the `@angular/ssr` `RenderMode`/`ServerRoute` API [A-v20/A-v21 keyword presence]. Whether `RenderMode` config first appeared in 19 (as developer preview) is unverified from the fetched sources.
- Zone.js: hydration relies on Zone.js stability signal; custom or noop Zone.js "not yet fully supported" [A-latest]. Interaction with zoneless (stable in newer versions) is unverified here: ask user or check docs before advising zoneless + SSR combos.
- `provideClientHydration` must be on both server and client bootstrap.
- `@Service()` decorator appears in v22 doc samples; not relevant to SSR behavior.

## 11. Measuring SSR

| What | How | Source |
|---|---|---|
| TTFB | Lighthouse / DevTools Network Timing / field CrUX; good ≤ 0.8 s | [WEB ttfb] |
| LCP, FCP, CLS, INP | Lighthouse, PageSpeed Insights, CrUX, web-vitals JS | https://web.dev/articles/vitals |
| Is hydration on? | Dev console hydration stats; Angular DevTools overlay | [A-latest] |
| Server render time per route | `Server-Timing` header from the request handler around `angularApp.handle(req)`; Angular docs do not document a built-in render-time metric | Proposed; verify in project |
| What did the server send? | `curl -s URL` / view-source, search for real content | Proposed |
| Duplicate HTTP calls | DevTools Network after load; compare with server-side requests | Proposed |
| Stability delays | `provideStabilityDebugging` + task-tracking plugin | [A-latest] |
| Server memory | Heap snapshots, RSS under load | Unverified for Angular specifics |
| Cold start | Compare first vs subsequent request TTFB on serverless | Proposed; no Angular data |

`mcp__chrome-devtools` lighthouse and performance trace tools can run the client-side measures. Auto-measuring is safe; changing config is not.

## 12. Automate vs user decision

Safe to automate (read-only or reversible, no behavior change):
- Detect Angular major and whether `@angular/ssr`, `provideServerRendering`, `provideClientHydration` exist and on both server and client.
- List routes and current `RenderMode`; flag missing `**` server route.
- Grep for bare `window`/`document`/`localStorage`/`isPlatformBrowser` in templates.
- Flag `ngSkipHydration` usages, `preserveWhitespaces` differences, `<table>` without `<tbody>` in templates.
- Report duplicate requests and `view-source` content presence via a trace.

Needs the user's decision:
- Choosing `RenderMode` per route, dropping SSR, `outputMode: static`.
- Any transfer-cache widening (`includePostRequests`, auth headers, credentials, non-cacheable) and `resource({id})`.
- `hydrate` triggers and `hydrate never` (changes UX).
- CDN caching rules for SSR HTML; CDN HTML optimization toggles.
- Adding `ngSkipHydration` (trades performance for correctness).
- Disabling incremental hydration on v22.
- Server infra (memory limits, serverless vs long-running).

## 13. Where to read more

- https://angular.dev/guide/ssr (server and hybrid rendering; transfer cache)
- https://angular.dev/guide/hydration
- https://angular.dev/guide/incremental-hydration
- https://angular.dev/guide/templates/defer
- https://angular.dev/errors (NG0500 to NG0507, NG02825)
- https://angular.dev/best-practices/performance/ssr (served the same guide in fetch; ctx7 snippet points at it)
- https://angular.dev/api/ssr/RenderMode, https://angular.dev/api/ssr/provideServerRendering
- https://web.dev/articles/ttfb, https://web.dev/articles/rendering-on-the-web, https://web.dev/articles/stale-while-revalidate
- https://angular.dev/reference/releases (support windows)

## Unverified claims and source disagreements (collected)

1. Introduction versions of event replay stable status (18 vs 19 vs 20) and incremental hydration (19 vs 20): only the `@publicApi 20.0` tag in source was seen.
2. Exact minor in which `maxResponseBodySize`, `includeRequestsWithCredentials`, `includeNonCacheableRequests`, and `resource({id})` transfer landed in v22: present in latest docs, absent from v20/v21 guides by keyword; the transfer-cache credential/non-cacheable defaults may have existed earlier in code.
3. Serverless cold-start impact, server memory leak specifics, CDN `stale-while-revalidate` behavior for SSR: not covered by fetched sources.
4. The SSRF/host-validation section (`llms-full.txt` line ~18335) was located but not read.
5. Effect of long timers on server response time (hold request open until stable): inferred from stability docs.
6. Zoneless + SSR + hydration interaction not checked.
7. `httpResource` transfer-state behavior and direct `fetch()` not covered by transfer cache: inferred.
8. `web.dev/articles/rendering-on-the-web` is framework-agnostic and older; its rehydration skepticism partly conflicts with Angular's docs, which present hydration plus event replay as the fix for the same problem. Angular docs are treated as authoritative for Angular behavior.
9. TTFB "poor above 1.8 s" was truncated in extraction; only the 0.8 s "good" threshold was fully confirmed.
10. `ng new --ssr` defaults per version (whether `withEventReplay()` is included) not verified.

## Proposed skill content: `references/ssr.md`

Outline (each topic block: what it is, how to measure, options by size, pitfalls, links). Keep the file under ~300 lines; put version table first.

1. Version gate (read `package.json`): table from section 0. Rule: never suggest `withIncrementalHydration()` on 22+; never assume the v22 default on 20/21.
2. Decide if SSR is worth it: decision guide from section 1. Ask the user (single question): "Is the page public and the same for all users?" Options: yes then Prerender; public but dynamic then SSR + cache; no then CSR.
3. Rendering mode per route
   - Measure: view-source, build output, Lighthouse.
   - Quick: prerender static routes. Moderate: `getPrerenderParams` + `fallback`. Planned: `outputMode: static` or split SSR/CSR.
   - Pitfalls: `REQUEST` null in SSG, soft redirects, build time growth.
   - Links: guide/ssr, api/ssr/RenderMode.
4. Hydration, event replay, incremental hydration
   - Measure: dev console stats, DevTools overlay, INP.
   - Quick: enable hydration on both bootstraps. Moderate: `@defer (hydrate on viewport|interaction)`. Planned: islands, `hydrate never`.
   - Pitfalls: nested ordering, `hydrate when` only top-most, v22 default flip.
5. HTTP transfer cache and duplicates
   - Measure: Network tab duplicates. Options: origin map, `filter`, `resource({id})` on v22.
   - Pitfalls: privacy leak into cached HTML, auth headers excluded by design, `maxResponseBodySize`.
6. Hydration mismatch triage: table from section 5 (symptom NG05xx to cause to fix), `ngSkipHydration` last resort.
7. Browser-only code: `afterNextRender`, platform providers, `DOCUMENT`, no `isPlatformBrowser` in templates. Include a grep recipe for the automatable audit.
8. `@defer` on the server: placeholder-only by default; `hydrate` triggers render main content; SEO check.
9. SSR pitfalls: request-scoped state (`useFactory`), timers and stability (`provideStabilityDebugging`), third-party scripts, SSRF (link, contents to be read before including), unverified memory-leak guidance flagged as such.
10. Caching SSR output: Prerender vs SSR, `ServerRoute.headers`, personalisation rule, CDN HTML-minify off (NG0507), SWR as vendor-dependent (mark unverified).
11. Measuring SSR: table from section 11, including a `Server-Timing` snippet marked "proposed".
12. Automate vs ask: lists from section 12 verbatim.
13. Links: section 13.
14. Audit script hooks (for `scripts/audit.mjs`): detect `provideServerRendering`, `provideClientHydration` in both configs, `withEventReplay`/`withNoIncrementalHydration`, `ngSkipHydration`, `isPlatformBrowser` in templates, `window`/`document` use, `preserveWhitespaces` in tsconfigs, `outputMode`, server routes file and modes.
