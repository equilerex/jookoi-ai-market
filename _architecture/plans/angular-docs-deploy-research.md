# Angular docs map and build/deploy performance research

Researched 2026-09-21. Angular latest on npm: `@angular/core` 22.1.7 (`next` 22.2.0-rc.0), `@angular/build` 22.1.8, `@angular/service-worker` 22.1.7. Builder schema and adev guides were read from `main` branches (not version tags), so option defaults may differ in 20.x/21.x. Where a claim came from a source I did not open, it is marked **UNVERIFIED**.

Verification method: `angular.dev` returns HTTP 200 for any path (a bogus path returns the "Home" page), so URLs were verified by page `<title>`. "Home" title = dead link.

## Part A. Docs and tools map

### A1. Angular official guides (title-verified)

| URL | Use it when |
|---|---|
| https://angular.dev/best-practices/runtime-performance | Change detection is slow; entry point for OnPush, slow computations, zone pollution |
| https://angular.dev/best-practices/slow-computations | Template expressions or lifecycle hooks do heavy work |
| https://angular.dev/best-practices/zone-pollution | Third-party or timer code triggers change detection too often (zone.js apps) |
| https://angular.dev/best-practices/profiling-with-chrome-devtools | You need to see Angular-specific entries in a Chrome performance trace |
| https://angular.dev/tools/devtools | Component tree and change detection profiler in the browser |
| https://angular.dev/guide/zoneless | Considering removing zone.js. Main-branch text says zoneless is the default in v21+ and that `zone.js` should be removed from `polyfills` in `build` and `test` targets |
| https://angular.dev/guide/templates/defer | Heavy below-the-fold or interaction-gated components should leave the initial bundle |
| https://angular.dev/guide/image-optimization | LCP image or many images. Covers `ngSrc`, `priority` (sets `fetchpriority`, adds preconnect), required width/height (CLS), image loaders |
| https://angular.dev/guide/ssr | Deciding SSR vs SSG vs CSR per route (`RenderMode`, `outputMode`) |
| https://angular.dev/guide/hydration | SSR already in place; avoid re-rendering DOM on the client |
| https://angular.dev/guide/incremental-hydration | SSR app where hydration JS cost is large; ties into `@defer (hydrate on ...)` |
| https://angular.dev/guide/routing/loading-strategies | Eager vs lazy route loading (`loadComponent`, `loadChildren`) |
| https://angular.dev/guide/routing/customizing-route-behavior | Preloading strategies (`PreloadAllModules`, custom `PreloadingStrategy`) |
| https://angular.dev/guide/routing/rendering-strategies | Per-route rendering choice from the router side |
| https://angular.dev/tools/cli/build | Build overview; contains "Configuring size budgets" (`#configuring-size-budgets`) |
| https://angular.dev/tools/cli/build-system-migration | Project still on the webpack `browser` builder; moving to `application` (esbuild) |
| https://angular.dev/tools/cli/aot-compiler | Confirming AOT behavior, template type checking |
| https://angular.dev/tools/cli/environments | Explaining `production` vs `development` configurations and file replacements |
| https://angular.dev/reference/configs/workspace-config | Reference for every builder option (optimization, sourceMap, fonts, budgets) |
| https://angular.dev/tools/cli/deployment | Static hosting basics: SPA fallback to `index.html`, CORS. No caching or compression guidance found in it |
| https://angular.dev/ecosystem/service-workers | Service worker overview |
| https://angular.dev/ecosystem/service-workers/config | `ngsw-config.json` reference (installMode, updateMode, dataGroups) |
| https://angular.dev/ecosystem/service-workers/communications | `SwUpdate`: `checkForUpdate`, version events, `activateUpdate`, unrecoverable state |
| https://angular.dev/ecosystem/service-workers/getting-started | `provideServiceWorker`, `registrationStrategy`, `updateViaCache` |
| https://angular.dev/ecosystem/service-workers/devops | Stale-client and cache-invalidation behavior, safe mode, hash verification |
| https://angular.dev/extended-diagnostics | Compiler diagnostics (e.g. NG8021 redundant prefetch on `@defer (on immediate)`) |
| https://angular.dev/api/common/NgOptimizedImage | API page for the image directive |

Dead or moved (do not cite):
- `https://angular.dev/guide/routing/loading-strategy` and `.../guide/routing/preloading`: Home page. Correct paths are `loading-strategies` and `customizing-route-behavior`.
- `https://angular.dev/api/core/NgOptimizedImage`: Home page. Correct: `/api/common/NgOptimizedImage`.
- `https://angular.dev/guide/ssr-caching`: Home page.
- `https://angular.dev/guide/performance` renders "Server-side & hybrid-rendering • Overview", not a performance hub. `guide/prerendering` and `guide/hybrid-rendering` return a "Redirecting" page (target not resolved). Prerendering is documented inside `guide/ssr`.
- `https://angular.dev/best-practices/runtime-performance/overview`: Home page. Use the URL without `/overview`.
- https://github.com/angular-eslint/angular-eslint is the correct repo; `github.com/angular/angular-eslint` is 404.

### A2. Web performance (non-Angular), all HTTP 200 with correct titles

| URL | Use it when |
|---|---|
| https://web.dev/articles/vitals | Explaining Core Web Vitals and their thresholds |
| https://web.dev/articles/lcp and https://web.dev/articles/optimize-lcp | LCP is the failing metric; optimize-lcp breaks LCP into subparts |
| https://web.dev/articles/inp and https://web.dev/articles/optimize-inp | Interactions feel slow; optimize-inp covers input delay, processing, presentation delay |
| https://web.dev/articles/cls and https://web.dev/articles/optimize-cls | Layout shifts (images without dimensions, late fonts, injected content) |
| https://web.dev/articles/optimize-long-tasks | Main-thread blocking; yielding strategies |
| https://web.dev/articles/fetch-priority | Tuning `fetchpriority` for LCP image or deprioritizing others |
| https://web.dev/articles/preload-critical-assets | Manual preload hints |
| https://web.dev/articles/http-cache | Designing Cache-Control for hashed vs unhashed files |
| https://web.dev/articles/codelab-text-compression-brotli | Enabling Brotli on a server |
| https://web.dev/articles/service-worker-lifecycle | Understanding install/waiting/activate, why old SW versions linger |
| https://web.dev/articles/performance-budgets-101 | Choosing budget metrics |
| https://web.dev/articles/lab-and-field-data-differences | Lighthouse and real users disagree |
| https://web.dev/articles/vitals-measurement-getting-started | Choosing lab vs field tooling |
| https://developer.chrome.com/docs/devtools/performance | Recording and reading a performance trace |
| https://developer.chrome.com/docs/devtools/performance/reference | Panel feature reference |
| https://developer.chrome.com/docs/devtools/network | Verifying headers, protocol, compression, cache hits |
| https://developer.chrome.com/docs/lighthouse/overview | Lab audit basics |
| https://developer.chrome.com/docs/lighthouse/performance/performance-scoring | Explaining how the Lighthouse score is weighted |
| https://developer.chrome.com/docs/crux | Field data from real Chrome users (CrUX) |
| https://pagespeed.web.dev/ | Quick combined lab (Lighthouse) + CrUX field check for a public URL |

Dead: `https://web.dev/articles/rum` (404), `https://web.dev/articles/http2` (404), `https://developer.chrome.com/docs/crux/guides/crux-vis` (404). I found no verified web.dev RUM setup article; use the web-vitals README below.

### A3. Tools (repos verified reachable; versions from npm 2026-09-21)

| Tool | URL | Version | Use it when |
|---|---|---|---|
| web-vitals | https://github.com/GoogleChrome/web-vitals | 6.2.2 | Send LCP/INP/CLS from real users to your analytics; attribution build shows the culprit element/interaction |
| Lighthouse CI | https://github.com/GoogleChrome/lighthouse-ci , docs https://googlechrome.github.io/lighthouse-ci/docs/getting-started.html | `@lhci/cli` 0.15.1 | Gate PRs on Lighthouse scores/assertions, compare against a baseline |
| esbuild bundle analyzer | https://esbuild.github.io/analyze/ | n/a | Upload the builder's `stats.json` (`statsJson: true`, schema says it "can be analyzed with" this page) to see what is in each chunk |
| source-map-explorer | https://github.com/danvk/source-map-explorer | 2.5.3 | Treemap from JS + sourcemap. Needs `sourceMap` output; works on esbuild output but I did not test it (**UNVERIFIED** for Angular 22 output) |
| angular-eslint | https://github.com/angular-eslint/angular-eslint | 22.5.0 | Lint-time performance hygiene (rules below) |
| PageSpeed Insights | https://pagespeed.web.dev/ | n/a | See A2 |
| DebugBear | https://www.debugbear.com/ | commercial | RUM/synthetic monitoring if the user wants a paid service (no evaluation done) |
| Bundlephobia | https://bundlephobia.com | n/a | Reachable; page title was a generic "Github Link", purpose is checking a package's install/bundle cost (**UNVERIFIED** currency) |

angular-eslint rules with performance relevance (present in the main-branch README on 2026-09-21; not all are in the `recommended` config, per-rule config not checked):
- `@angular-eslint/prefer-on-push-component-change-detection`
- `@angular-eslint/prefer-signals`
- `@angular-eslint/template/prefer-ngsrc` (use `NgOptimizedImage`)
- `@angular-eslint/template/use-track-by-function`
- `@angular-eslint/template/no-call-expression` (function calls in templates rerun every change detection)
- `@angular-eslint/template/prefer-control-flow`
- `@angular-eslint/template/prefer-at-empty`

Rule docs pattern: `https://github.com/angular-eslint/angular-eslint/blob/main/packages/eslint-plugin/docs/rules/<rule>.md` and `.../eslint-plugin-template/docs/rules/<rule>.md`.

### A4. The official `angular-developer` skill

Source: https://github.com/angular/skills (`angular-developer/SKILL.md` + `references/*.md`, plus `angular-new-app`). `BUILD_INFO` timestamp Fri Sep 18 2026, commit `7569a02d2961155cc32b9491918bde8ae4c47616`.

What it says about performance:
- SKILL.md line 14: "follow Angular's style guide and best practices for maintainability and performance". Generic, no specifics.
- `references/loading-strategies.md`: eager for primary landing pages, lazy (`loadComponent`/`loadChildren`) for everything else; loader functions run in injection context.
- `references/rendering-strategies.md`: CSR/SSG/SSR, full vs incremental hydration (via `@defer`), event replay. Brief.
- Reference files list has no performance, profiling, budgets, image optimization, `@defer` tuning, service worker, build config, deploy, caching or CI reference.

Implication: no contradiction found and little overlap. Our skill should not re-teach lazy loading basics or rendering mode definitions; link to these and add diagnosis, measurement, build/deploy and advisory content. `NgOptimizedImage`, `@defer` and zoneless are covered only in the angular.dev guides, not in the official skill.

## Part B. Build, deploy, caching, service worker

Effort: S = under an hour, M = days, L = planned project. Risk = chance of user-visible regression.

### B1. Application builder options (schema from `@angular/build` main; 22.1.8 package inspected)

Options present in schema: `optimization`, `sourceMap`, `outputHashing`, `namedChunks`, `aot`, `budgets`, `prerender`, `ssr`, `outputMode`, `polyfills`, `extractLicenses`, `subresourceIntegrity`, `serviceWorker`, `statsJson`, `crossOrigin`, `deployUrl`, `baseHref`, `security` (`allowedHosts`, `autoCsp`), `externalDependencies`, `allowedCommonJsDependencies`, `appShell`, `define`, `loader`, `index`. There is NO `preloadDependencies` option in the schema.

| Option | Schema default | Effect and measure | Risk / effort | Doc |
|---|---|---|---|---|
| `optimization` | `true` (object form: `scripts`, `styles.minify`, `styles.inlineCritical`, `styles.removeSpecialComments`, `fonts.inline`) | Minify, tree-shake, inline critical CSS, inline Google/Adobe Fonts CSS. Measure: build output summary + Lighthouse render-blocking audit | Low. `fonts` inlining needs internet at build time (`HTTPS_PROXY` supported); offline CI can fail. S | workspace-config#optimization-options (anchor unverified) |
| `inlineCritical` | `true` | Async-loads full CSS and inlines critical CSS; improves FCP. Trade-off: larger `index.html`; strict CSP interplay (**UNVERIFIED**) | Low. S | workspace-config |
| `fonts.inline` | `true` | Removes a render-blocking font CSS request | Low; build-time network. S | workspace-config |
| `sourceMap` | `false` | Object form: `scripts`, `styles`, `hidden`, `vendor`, `sourcesContent`. `hidden: true` omits the link from the bundle, but docs warn you must not serve the `.map` files publicly | Medium (source leak if served). S | workspace-config (#source-map-configuration) |
| `outputHashing` | `none` in schema (new apps set `all` in the production config; **UNVERIFIED**, check user's angular.json) | `all` = hash every output; `bundles`, `media`, `none`. Required for immutable caching | High impact if missing: `none` forces short caches or stale assets. S | workspace-config |
| `namedChunks` | `false` | Readable chunk names. Debug aid only; keep off in production | Low. S | workspace-config |
| `aot` | `true` | JIT in production is a mistake (larger, slower). Check `angular.json` for `"aot": false` | Low. S | tools/cli/aot-compiler |
| `budgets` | `[]` in schema; types: `all`, `allScript`, `any`, `anyScript`, `anyComponentStyle`, `bundle`, `initial`. Fields: `baseline`, `maximumWarning/Error`, `minimumWarning/Error`, `warning`, `error`. `initial` corresponds to "Initial Total" in build output | Warn/error when a size is reached. Default values in generated apps: **UNVERIFIED** | Low. S to add, M to tune | tools/cli/build#configuring-size-budgets |
| `prerender` | undefined (`routesFile`, discover routes options) | SSG at build. Docs warn it can add "significant time" to builds and cannot use data unavailable at build time. Docs (`ssr`) say the default with SSR is to prerender the whole app and emit a server file; set `outputMode` `static` for fully static | Medium. M | guide/ssr |
| `ssr` / `outputMode` | `false` / undefined; `static` or `server` | See guide/ssr | Medium to high. L | guide/ssr |
| `polyfills` | `[]` | `zone.js` here is the main removable polyfill for zoneless (see A1). Check what else is listed | Medium (must be zoneless-ready). L | guide/zoneless |
| `extractLicenses` | `true` | Writes a license file; small size effect | None. | schema only |
| `subresourceIntegrity` | `false` | Adds SRI hashes; security, not speed | Low | schema only |
| `statsJson` | `false` | Emits `stats.json` for the esbuild analyzer | None. S | https://esbuild.github.io/analyze/ |
| `security.autoCsp` | `false` | Hash-based strict CSP generated from index.html scripts; schema says "experimental/preview" | Medium. M | schema description; https://web.dev/articles/strict-csp |

Automation guidance: safe to automate (S, reversible): report values, enable `statsJson` in a scratch config, add budgets in warning mode. User decision needed: `sourceMap` policy, `outputMode`/`ssr`, removing `zone.js`, changing `outputHashing` if a CDN/deploy script depends on filenames.

### B2. Production vs development configuration mistakes

Check in `angular.json` / `project.json` (all measured by reading config, then confirming with a build and network panel):
- Deploying output of `ng build --configuration development` (or a `defaultConfiguration` of `development` on the build target). Effect: no optimization, sourcemaps on, hashing off. Docs: https://angular.dev/tools/cli/environments.
- `optimization: false`, `aot: false`, `outputHashing: none`, `namedChunks: true`, `sourceMap: true` in the production configuration.
- Sourcemaps served publicly (see `hidden` warning above).
- `budgets` missing or set so high they never trigger.
- `ng serve` timings used as a performance measure (dev server, unminified).
- Existing `browser` (webpack) builder: migrate via https://angular.dev/tools/cli/build-system-migration.
Risk of fixing: low, except hashing changes if external systems reference fixed filenames. Effort S.

### B3. Preload / modulepreload behavior (verified from `@angular/build` 22.1.8 source, `src/tools/esbuild/index-html-generator.js`)

- The builder emits `<link rel="modulepreload">` for initial-graph scripts that are not entry points (`MODULE_PRELOAD_MAX = 10`, sorted by smallest import depth first), and `<link rel="preload" as="style">` for initial styles. Gated on an internal `indexHtmlOptions.preloadInitial` flag and skipped when `externalPackages` is set.
- Lazy chunks are not preloaded by this mechanism. Lazy route preloading is a router feature (`withPreloading`, see A1).
- No user-facing option was found to change the limit of 10. Whether `preloadInitial` is exposed to users: **UNVERIFIED** (not in the schema).
- Measure: view-source of built `index.html`; Network panel waterfall for chunk discovery chains. Manual hints and priorities: https://web.dev/articles/preload-critical-assets, https://web.dev/articles/fetch-priority.

### B4. Compression, Brotli, cache headers, HTTP/2/3, CDN

Not found in Angular docs: `tools/cli/deployment` covers SPA fallback and CORS only. I found no compression setting in the application builder JS (grep for gzip/brotli/compress in `builders/application` found only an unrelated chunk-optimizer minify setting). So compression is a server/CDN responsibility. Any statement that the CLI prints gzip/brotli "estimated transfer size" is **UNVERIFIED**.

| Item | How to measure | Options | Risk / effort | Doc |
|---|---|---|---|---|
| Brotli/gzip on text assets | DevTools Network: `content-encoding` response header, transfer vs size columns | Enable at server/CDN; precompress at deploy time is a choice for the user | Low. S | https://web.dev/articles/codelab-text-compression-brotli |
| Cache-Control on hashed files | Response headers for `main-*.js`, `chunk-*.js`, `styles-*.css` | Long max-age plus `immutable` for hashed files; `no-cache` (revalidate) for `index.html`. Requires `outputHashing: all` or at least `bundles`+`media` | Medium: wrong `index.html` caching pins users to old versions. S | https://web.dev/articles/http-cache |
| `ngsw.json`, `ngsw-worker.js`, `index.html` caching | Headers | Must not be long-cached, or updates stall (see B5) | High. S | ecosystem/service-workers/getting-started (`updateViaCache`) |
| HTTP/2/3 | Network panel "Protocol" column (`h2`, `h3`) | Server/CDN setting. Angular does not configure this. No verified web.dev HTTP/2 article (their `articles/http2` is 404); specifics **UNVERIFIED** | Low. S to M | n/a |
| CDN | Compare TTFB/asset latency from user regions; check cache hit headers | Put static output (and SSR/prerendered HTML if applicable) behind a CDN; `deployUrl` builder option exists for "specific deployment scenarios such as CDN" (schema text) | Medium. M | tools/cli/deployment |
| SPA deep-link fallback | Request a deep route directly | Rewrite non-file requests to `index.html` (real 404s excepted) | Low. S | tools/cli/deployment |

### B5. Angular service worker (`@angular/service-worker` 22.1.7)

Facts from angular.dev docs (main):
- `assetGroups[].installMode`: `prefetch` (default; fetch every listed resource at install, bandwidth heavy) or `lazy` (cache only what is requested). `updateMode`: `prefetch` or `lazy`, defaults to `installMode`; `updateMode: lazy` is only valid if `installMode` is also `lazy`.
- Lazy chunks: put JS in an asset group. With `prefetch` all listed lazy chunks download at install (heavy for big apps); with `lazy` they are cached on first request. Which to choose per app is a user decision. Generated `ngsw-config.json` only lists a limited set of font/image extensions ("you might want to modify the glob pattern").
- `dataGroups[].cacheConfig.strategy`: `performance` (default, cache first, may be stale until `maxAge`) or `freshness` (network first with `timeout`, cache fallback). Opaque responses are cached by default for `freshness` groups and not for `performance` groups.
- `navigationRequestStrategy`: `performance` (default, serves cached index) or `freshness` (network pass-through; docs say more requests, higher latency, prefer default). `applicationMaxAge` limits how long the SW serves the app from cache.
- Registration: `provideServiceWorker(..., { registrationStrategy: 'registerWhenStable:30000' })` is the default; also `registerImmediately`, `registerWithDelay:<ms>`, or a custom Observable factory. `updateViaCache` option: `'imports' | 'all' | 'none'`.
- Update UX (`SwUpdate`): `checkForUpdate()`, version events, prompt then reload. Docs warn `activateUpdate()` without reload can break the app by mixing the old shell with lazy chunks whose filenames changed between versions. Subscribe to `SwUpdate#unrecoverable` for broken-state clients.
- Stale clients (devops guide): the SW may serve multiple versions at once; it acts like a long-lived forward cache and ignores the normal hard-refresh escape hatch; it verifies file hashes against `ngsw.json`, retries with cache-busting params, and drops to safe mode (network) on mismatch; state `EXISTING_CLIENTS_ONLY` keeps old tabs on cached versions.
- Unhashed resources without a hash are cached but honor HTTP headers with stale-while-revalidate.

Pitfalls to advise on (each traceable to the above): long-caching `ngsw.json`/index at CDN; forgetting to wire an update prompt; using `activateUpdate()` without reload; `prefetch` of all lazy chunks on mobile; CDN serving mixed old/new files during deploy (docs list "caching layers between origin and user could serve stale content" as a cause of hash failures).
Measure: DevTools Application > Service Workers and Cache Storage; Network panel "(ServiceWorker)" source; Lighthouse PWA-related audits (**UNVERIFIED**, category was reorganized in recent Lighthouse versions).
Effort: adding SW is M; tuning `ngsw-config` S/M; update UX M. Risk: medium to high (stale clients are hard to recover). Doc links: A1 service worker rows.

### B6. CI performance gates

| Gate | How | Notes | Risk / effort |
|---|---|---|---|
| Budgets | `ng build` fails when a budget `error` threshold is exceeded | Built in; start with warnings, then errors with headroom | Low. S |
| Bundle diff | Save `stats.json` (`statsJson: true`) per build; compare chunk sizes between base and PR | The builder emits the file; comparing tools are custom or third party. I did not verify a maintained diff tool for esbuild metafiles | Medium. M |
| Lighthouse CI | `npm i -g @lhci/cli`, `lhci autorun` with `lighthouserc` assertions | Lab data is noisy; use multiple runs, assert on category scores and specific audits. Docs: https://googlechrome.github.io/lighthouse-ci/docs/getting-started.html | Medium (flaky gates). M |
| Lint | angular-eslint rules from A3 | Cheap, no runtime | Low. S |

### B7. RUM (real user monitoring)

- Library: `web-vitals` 6.2.2 (https://github.com/GoogleChrome/web-vitals). Call `onLCP`, `onINP`, `onCLS` and post results to an endpoint (README usage; exact API for 6.x not re-read, check README before writing code, **UNVERIFIED** for signatures).
- Angular integration point: call from `main.ts` or an `APP_INITIALIZER`/`provideAppInitializer`, and keep it out of the initial critical path (dynamic import after bootstrap). Zone/change detection: reporter callbacks should run outside Angular's zone in zone.js apps (**UNVERIFIED** as a documented recommendation).
- Field data without instrumenting: CrUX via PageSpeed Insights or https://developer.chrome.com/docs/crux (public origins with enough traffic only).
- Thresholds (LCP good <= 2.5 s, INP <= 200 ms, CLS <= 0.1): standard values, taken from memory, **UNVERIFIED** in this session; confirm on https://web.dev/articles/vitals before quoting.
- Needs user decision: where data goes, privacy/consent, sampling rate. Effort M. Risk low if async and sampled.

### B8. Three-size options summary

| Size | Options |
|---|---|
| Quick win (S) | Verify production config (B2); `statsJson` + analyzer look; add warning budgets; check `Cache-Control`, compression, `h2/h3` via DevTools; `ngSrc` + `priority` on LCP image; check `ngsw.json`/index not long-cached |
| Moderate (M) | Tighten budgets to errors; `@defer` heavy blocks; custom preloading strategy; SW update prompt and `ngsw-config` tuning; Lighthouse CI; RUM with web-vitals; CDN fronting |
| Planned project (L) | Migrate from webpack `browser` builder; go zoneless and drop `zone.js`; SSR/SSG with hydration or incremental hydration; introduce SW/PWA; `autoCsp`; full performance-budget programme with bundle diffing |

Automatable safely (read-only or reversible): reading configs, running a build, `statsJson`, budgets in warning mode, lint rules in warn mode, header inspection. Needs the user: sourcemap exposure, hashing/filename changes, SSR/prerender, zone removal, SW enablement and lazy chunk policy, CDN/cache rules, RUM destination.

## Proposed skill content

### `references/docs-map.md` (outline)

1. How to use (route by symptom first, then link; do not paraphrase what the docs already say).
2. Angular guides table (A1) grouped: runtime/change detection, loading (lazy, `@defer`, preloading), rendering (SSR, hydration, incremental), images, tooling (DevTools, profiling, CLI build).
3. Web vitals and browser tooling (A2): one row per metric (LCP, INP, CLS) with the "optimize-*" article, plus DevTools and Lighthouse rows.
4. Tools (A3): web-vitals, LHCI, esbuild analyzer, source-map-explorer, angular-eslint rules with the "use when" line.
5. Overlap with official `angular-developer` skill (A4): what it covers, what we deliberately do not duplicate.
6. Known dead links list and the corrected paths (append-only, with verification date). Rule: verify by `<title>`, not HTTP status, because angular.dev answers 200 for unknown paths.
7. Version note: Angular 20-22; zoneless default from v21 per main-branch docs; re-check for the user's version.

### `references/build-and-deploy.md` (outline)

1. Read-first checklist: `angular.json` build target, configuration used for deployment (B2).
2. Builder options table (B1) with default, effect, risk, effort, doc link.
3. Preload behavior (B3): what is automatic, what is not, limit 10.
4. Server layer (B4): compression, Cache-Control matrix (hashed vs `index.html` vs `ngsw.json`), HTTP/2/3, CDN. State plainly that Angular docs do not cover these and link web.dev.
5. Service worker (B5): options, update UX pattern, stale-client pitfalls, when not to add one.
6. CI gates (B6) and RUM (B7).
7. Three-size ladder (B8) and an "automate vs ask the user" table.
8. Unverified claims list (copy from below) so the skill can hedge them.

## Unverified / disagreements / gaps

- Builder defaults were read from `main`, not per-version tags for 20/21/22.
- `outputHashing` production default in generated apps, default budgets in generated apps: not checked.
- CLI compression or "estimated transfer size": not found, not verified.
- HTTP/2/3 and CDN guidance: no authoritative source fetched.
- `web-vitals` 6.x API signatures, Core Web Vitals threshold numbers: not re-read this session.
- source-map-explorer with Angular 22 esbuild output, Lighthouse PWA audit status, bundle-diff tooling: not tested.
- `preloadInitial` exposure to users: not found in schema.
- Source disagreement: the ctx7 index (`/websites/angular_dev`) points at `https://angular.dev/guide/routing/customizing-route-behavior` for preloading, while older URLs (`guide/routing/preloading`, `loading-strategy`) are dead; ctx7 `/angular/angular` lists versions up to 20.0.0 and `__branch__22.0.x`, so it lags the npm 22.1.7 release.
- Official `angular-developer` skill: no contradictions with this research; just thin on performance.
