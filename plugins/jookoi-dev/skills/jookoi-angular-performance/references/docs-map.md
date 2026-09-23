# Docs map

Canonical URLs by topic, each checked on 2026-09-21. `angular.dev` returns HTTP 200 for any path (unknown paths render the Home page), so these were verified by page `<title>`, not status code. Guides were read from `main`, so wording about defaults may differ in 20.x and 21.x. Link to these instead of paraphrasing them.

## Angular guides

| URL | Use it when |
|---|---|
| https://angular.dev/best-practices/runtime-performance | Change detection is slow. Entry point for OnPush, slow computations, zone pollution |
| https://angular.dev/best-practices/slow-computations | Template expressions or lifecycle hooks do heavy work |
| https://angular.dev/best-practices/zone-pollution | Third-party or timer code triggers change detection too often (zone.js apps) |
| https://angular.dev/best-practices/profiling-with-chrome-devtools | You need Angular-specific entries in a Chrome performance trace |
| https://angular.dev/tools/devtools | Component tree and change detection profiler |
| https://angular.dev/guide/zoneless | Considering removing zone.js. Main-branch text says zoneless is the default in v21+ and `zone.js` should leave `polyfills` in `build` and `test` targets |
| https://angular.dev/guide/templates/defer | Heavy or interaction-gated components should leave the initial bundle |
| https://angular.dev/guide/image-optimization | LCP image or many images. Covers `ngSrc`, `priority`, required width/height, loaders |
| https://angular.dev/api/common/NgOptimizedImage | API page for the image directive |
| https://angular.dev/guide/ssr | Choosing SSR, SSG or CSR per route (`RenderMode`, `outputMode`). Prerendering is documented here |
| https://angular.dev/guide/hydration | SSR is in place and the client should reuse the DOM |
| https://angular.dev/guide/incremental-hydration | Hydration JS cost is large. Ties into `@defer (hydrate on ...)` |
| https://angular.dev/guide/routing/loading-strategies | Eager vs lazy route loading |
| https://angular.dev/guide/routing/customizing-route-behavior | Preloading strategies (`PreloadAllModules`, custom `PreloadingStrategy`) |
| https://angular.dev/guide/routing/rendering-strategies | Per-route rendering choice from the router side |
| https://angular.dev/tools/cli/build | Build overview. Contains "Configuring size budgets" (`#configuring-size-budgets`) |
| https://angular.dev/tools/cli/build-system-migration | Project is on the webpack `browser` builder and should move to `application` |
| https://angular.dev/tools/cli/aot-compiler | Confirming AOT behavior and template type checking |
| https://angular.dev/tools/cli/environments | Explaining `production` vs `development` configurations and file replacements |
| https://angular.dev/reference/configs/workspace-config | Reference for every builder option |
| https://angular.dev/tools/cli/deployment | Static hosting basics: SPA fallback to `index.html`, CORS. No caching or compression guidance |
| https://angular.dev/ecosystem/service-workers | Service worker overview |
| https://angular.dev/ecosystem/service-workers/config | `ngsw-config.json` reference (`installMode`, `updateMode`, `dataGroups`) |
| https://angular.dev/ecosystem/service-workers/communications | `SwUpdate`: `checkForUpdate`, version events, `activateUpdate`, unrecoverable state |
| https://angular.dev/ecosystem/service-workers/getting-started | `provideServiceWorker`, `registrationStrategy`, `updateViaCache` |
| https://angular.dev/ecosystem/service-workers/devops | Stale clients, cache invalidation, safe mode, hash verification |
| https://angular.dev/extended-diagnostics | Compiler diagnostics (for example NG8021, redundant prefetch on `@defer (on immediate)`) |

## Web performance and browser tooling

| URL | Use it when |
|---|---|
| https://web.dev/articles/vitals | Explaining Core Web Vitals |
| https://web.dev/articles/lcp and https://web.dev/articles/optimize-lcp | LCP fails. `optimize-lcp` splits it into subparts |
| https://web.dev/articles/inp and https://web.dev/articles/optimize-inp | Interactions feel slow. Covers input delay, processing, presentation delay |
| https://web.dev/articles/cls and https://web.dev/articles/optimize-cls | Layout shifts from images without dimensions, late fonts, injected content |
| https://web.dev/articles/optimize-long-tasks | Main-thread blocking and yielding |
| https://web.dev/articles/fetch-priority | Tuning `fetchpriority` for the LCP image or deprioritizing others |
| https://web.dev/articles/preload-critical-assets | Manual preload hints |
| https://web.dev/articles/http-cache | Designing `Cache-Control` for hashed vs unhashed files |
| https://web.dev/articles/codelab-text-compression-brotli | Enabling Brotli on a server |
| https://web.dev/articles/service-worker-lifecycle | Why old service worker versions linger (install, waiting, activate) |
| https://web.dev/articles/performance-budgets-101 | Choosing budget metrics |
| https://web.dev/articles/lab-and-field-data-differences | Lighthouse and real users disagree |
| https://web.dev/articles/vitals-measurement-getting-started | Choosing lab vs field tooling |
| https://developer.chrome.com/docs/devtools/performance | Recording and reading a trace |
| https://developer.chrome.com/docs/devtools/performance/reference | Performance panel feature reference |
| https://developer.chrome.com/docs/devtools/network | Verifying headers, protocol, compression, cache hits |
| https://developer.chrome.com/docs/lighthouse/overview | Lab audit basics |
| https://developer.chrome.com/docs/lighthouse/performance/performance-scoring | How the Lighthouse score is weighted |
| https://developer.chrome.com/docs/crux | Field data from real Chrome users |
| https://developer.chrome.com/docs/devtools/coverage | Used vs unused CSS and JS bytes (reflects only the recorded session) |
| https://developer.chrome.com/docs/lighthouse/performance/third-party-facades | Facades for embeds (video, chat) |
| https://pagespeed.web.dev/ | Quick lab plus CrUX check for a public URL |

## Tools

| Tool | URL | Use it when |
|---|---|---|
| web-vitals | https://github.com/GoogleChrome/web-vitals | Sending LCP, INP, CLS from real users. Attribution build names the culprit |
| Lighthouse CI | https://googlechrome.github.io/lighthouse-ci/docs/getting-started.html | Gating on Lighthouse assertions. See `measurement-automation.md` |
| esbuild analyzer | https://esbuild.github.io/analyze/ | Opening the builder's stats file to see what is in each chunk. See `measuring.md` |
| angular-eslint | https://github.com/angular-eslint/angular-eslint | Lint-time hygiene |

`angular-eslint` rules with performance relevance (present in the `main` README, per-rule presence in `recommended` not checked): `@angular-eslint/prefer-on-push-component-change-detection`, `@angular-eslint/prefer-signals`, `@angular-eslint/template/prefer-ngsrc`, `@angular-eslint/template/use-track-by-function`, `@angular-eslint/template/no-call-expression`, `@angular-eslint/template/prefer-control-flow`, `@angular-eslint/template/prefer-at-empty`. Rule docs live under `https://github.com/angular-eslint/angular-eslint/blob/main/packages/eslint-plugin/docs/rules/<rule>.md` and `.../eslint-plugin-template/docs/rules/<rule>.md`.

## Dead or moved URLs (do not cite)

- `angular.dev/guide/routing/loading-strategy` and `.../guide/routing/preloading`. Use `loading-strategies` and `customizing-route-behavior`.
- `angular.dev/api/core/NgOptimizedImage`. Use `/api/common/NgOptimizedImage`.
- `angular.dev/guide/ssr-caching`. Home page.
- `angular.dev/best-practices/runtime-performance/overview`. Use the URL without `/overview`.
- `angular.dev/guide/performance`. Renders "Server-side & hybrid-rendering Overview", not a performance hub.
- `angular.dev/guide/prerendering` and `.../guide/hybrid-rendering`. Redirect page with no resolved target. Prerendering lives in `guide/ssr`.
- `github.com/angular/angular-eslint`. 404. The repo is `angular-eslint/angular-eslint`.
- `web.dev/articles/rum`, `web.dev/articles/http2`, `web.dev/articles/serve-images-avif`, `web.dev/articles/third-party-facades`. All 404.
- `developer.chrome.com/docs/crux/guides/crux-vis`. 404.

## The official `angular-developer` skill

Source: https://github.com/angular/skills (`angular-developer/SKILL.md` plus `references/*.md`, and `angular-new-app`). Checked at the 2026-09-18 build (commit `7569a02d2961155cc32b9491918bde8ae4c47616`).

Covers: a generic "follow the style guide for maintainability and performance" line, `references/loading-strategies.md` (eager for primary landing pages, lazy for the rest, loader functions run in injection context), and `references/rendering-strategies.md` (CSR, SSG, SSR, full and incremental hydration via `@defer`, event replay, briefly).

Does not cover: profiling, budgets, image optimization, `@defer` tuning, service worker, build config, deploy, caching, CI. `NgOptimizedImage`, `@defer` and zoneless appear only in the angular.dev guides. No contradictions found. This skill should not re-teach lazy loading basics or rendering mode definitions, only diagnosis, measurement, and build and deploy advice.

## Unverified, check before relying

- Whether the `#optimization-options` anchor exists on the workspace-config page. Link the page without it.
- Whether `source-map-explorer` (2.5.3, unmaintained since 2022) works on Angular 22 esbuild output. Not tested.
