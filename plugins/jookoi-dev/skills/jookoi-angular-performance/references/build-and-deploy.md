# Build and deploy

Builder options that affect performance, what a generated app sets by default, automatic preload behavior, server and CDN layers, service worker settings, CI gates and RUM. Builder facts come from `@angular/build` `main` (package 22.1.8 inspected), so defaults may differ in 20.x and 21.x. Always read the project's own `angular.json` first. For chunk splitting and shared chunks see `chunk-size.md`, for router preloading see `preloading.md`, for SSR see `ssr.md`, for manual measuring see `measuring.md`.

## Check first

1. Which builder: `@angular/build:application` (esbuild) or the webpack `browser` builder. Migration: https://angular.dev/tools/cli/build-system-migration.
2. Which configuration is deployed. Output of `ng build --configuration development` (or a `defaultConfiguration` of `development` on the build target) ships unoptimized code.
3. In the production configuration, look for `optimization: false`, `aot: false`, `outputHashing: none`, `namedChunks: true`, `sourceMap: true`, missing or unreachable `budgets`.
4. `ng serve` timings are not performance numbers (dev server, unminified).

## Generated-app defaults (schematic on `main`, `strict` defaults to `true`)

- Production configuration sets only `budgets` and `outputHashing: 'all'`. Everything else is schema default.
- Development configuration sets `optimization: false`, `extractLicenses: false`, `sourceMap: true`.
- Schema defaults: `outputHashing` is `none`, `namedChunks` is `false`, `optimization` is `true`, `sourceMap` is `false`, `budgets` is `[]`. So a default production build minifies, inlines critical CSS and fonts CSS, hashes every output and ships no source maps.
- Budgets in a fresh strict app: `initial` warns at 500kB and errors at 1MB, `anyComponentStyle` warns at 4kB and errors at 8kB. The `strict: false` variant is `initial` 2MB/5MB and `anyComponentStyle` 6kB/10kB.
- angular.dev's build page says `anyComponentStyle` defaults are 2kb warning and 4kb error. That conflicts with the template. The project's `angular.json` decides. Recommendation: use the template's 4kB/8kB unless there is a reason. In a real run the 2kB/4kB pair warned constantly on two ordinary components (2.4 and 2.8 kB).
- Raw versus transferred: budgets are raw bytes. In a real run 536 kB raw was 130 kB in the build table's transfer column, so a 500kB raw budget is not a 500 kB download.
- Sizing a first budget: measured initial raw total x 1.15 for the warning, x 1.4 for the error, then ratchet down. Derivation rule, `anyScript` as the lazy-chunk cap and the "ask, then propose" step are in `chunk-size.md`, "Budgets and size". Never leave a budget set in an empty-app phase, it fails on the first real build.
- Budgets compare raw output bytes (`outputFile.size`, the content byte length). They are not compressed sizes. The build table's "Estimated transfer size" is a brotli estimate, display only, computed when script or style minify is on. It does not feed budgets.
- `initial` sums JS and CSS of initial chunks. `anyComponentStyle` checks each component stylesheet's raw bytes. Only browser output is budget-checked, server bundles are skipped.
- Stats file: option `statsJson` (flag `--stats-json`) writes the esbuild metafile at the output base, `dist/<project>/`, not inside `browser/`. Observed on 22.1.6 with SSR and `outputMode: static`: a single `dist/<project>/stats.json` holding browser outputs (`.js`, `.css`) and server outputs (`.mjs`). Source on `main` suggests `browser-stats.json` and `server-stats.json`, so check which exists. Lazy chunks appear as outputs with `entryPoint`. Open it at https://esbuild.github.io/analyze/, or use `scripts/route-cost.mjs` and `scripts/chunk-packages.mjs`. The name in 20.x and 21.x was not checked.
- **A failed build writes no stats file, and no output at all.** A build that fails on a budget or a prerender error leaves nothing to inspect. With `outputMode: static`, `--prerender=false`, `--output-mode server` and `--no-server` did not help in a real run. What worked: fix the blocking error (there, a parameterised redirect route needed a `RenderMode.Client` entry, see `ssr.md`), or build the development configuration with `--optimization --stats-json`. A budget failure alone is a fix-the-number problem, not a reason to skip measuring.

## Builder options that affect performance

| Option | Default | Effect | Risk |
|---|---|---|---|
| `optimization` | `true` (object form has `scripts`, `styles.minify`, `styles.inlineCritical`, `styles.removeSpecialComments`, `fonts.inline`, all `true`) | Minify, tree-shake, critical CSS, fonts CSS inlining | Low |
| `optimization.styles.inlineCritical` | `true` | Uses Beasties with `media-script`. Full stylesheet link becomes `media="print"` with `data-beasties-media`, one inline script restores it, `<noscript>` fallback added. CSP-safe via `ngCspNonce`. Critical CSS is computed from the HTML present at build time, so a CSR shell yields little | Larger `index.html` |
| `optimization.fonts.inline` | `true` | Fetches only the Google Fonts or Adobe Fonts CSS at build time, inlines it as `<style>`, adds `preconnect`. Does not download or self-host font files. Honors `HTTPS_PROXY`. A non-200 response fails the build | Needs network at build time |
| `sourceMap` | `false` | Object form: `scripts`, `styles`, `hidden`, `vendor`, `sourcesContent`. `hidden: true` omits the link from bundles, but `.map` files must not be served publicly | Source leak if served |
| `outputHashing` | `none` (`all`, `bundles`, `media`) | `all` is required for long-lived caching | Filename changes break external systems that reference fixed names |
| `namedChunks` | `false` | Readable lazy chunk names. Debug aid, keep off in production | Low |
| `aot` | `true` | JIT in production is a mistake | Low |
| `budgets` | `[]` | Types `all`, `allScript`, `any`, `anyScript`, `anyComponentStyle`, `bundle`, `initial`. See `measuring.md` for the JSON shape | Low |
| `statsJson` | `false` | Emits the stats file above | None |
| `prerender`, `ssr`, `outputMode` | see `ssr.md` | Docs warn `prerender` can add significant build time and cannot use data unavailable at build time | Medium to high |
| `polyfills` | `[]` | `zone.js` here is the main removable entry for zoneless apps. Check what else is listed | Needs zoneless-ready code |
| `deployUrl` | none | Schema text ties it to deployment scenarios such as a CDN | Low |
| `security.autoCsp` | `false` | Hash-based strict CSP from `index.html` scripts. Schema calls it experimental or preview | Medium |

There is no `preloadDependencies` option in the schema.

## Automatic modulepreload

From `@angular/build` 22.1.8, `index-html-generator.js`:

- The builder adds `<link rel="modulepreload">` for initial-graph scripts that are not entry points, at most 10 (`MODULE_PRELOAD_MAX`), ordered by smallest import depth first. It also adds `<link rel="preload" as="style">` for initial styles.
- It is gated on an internal `preloadInitial` flag and skipped when `externalPackages` is set.
- Lazy chunks are never preloaded this way. Lazy route preloading is a router feature, see `preloading.md`.
- No user-facing setting for the limit of 10 was found.
- Check by reading the built `index.html` and the Network waterfall for chunk discovery chains. Manual hints: https://web.dev/articles/preload-critical-assets and https://web.dev/articles/fetch-priority.

## Compression, caching, HTTP versions, CDN

Angular's builder has no compression setting (no gzip or brotli option found in the application builder), and https://angular.dev/tools/cli/deployment covers only SPA fallback and CORS. Compression, cache headers and protocol are server or CDN responsibilities.

| Item | Check | Guidance |
|---|---|---|
| Brotli or gzip | `content-encoding` header and transfer vs size columns in the Network panel | Enable on the server or CDN. https://web.dev/articles/codelab-text-compression-brotli |
| Hashed files (`main-*.js`, `chunk-*.js`, `styles-*.css`) | `Cache-Control` response header | Long-lived caching is safe only with `outputHashing: all` (or `bundles` plus `media`). https://web.dev/articles/http-cache |
| `index.html` | `Cache-Control` | Must revalidate, since a long-cached `index.html` pins users to old chunk names |
| `ngsw.json`, `ngsw-worker.js` | `Cache-Control` | Must not be long-cached or updates stall |
| SPA deep links | Request a deep route directly | Rewrite non-file requests to `index.html`, keep real 404s |
| CDN | TTFB and cache-hit headers from user regions | Put static output behind a CDN. `deployUrl` exists for this case |

Protocol (`h2`, `h3`) shows in the Network panel Protocol column. Angular does not configure it.

## Service worker (`@angular/service-worker`)

From the angular.dev docs on `main`:

- `assetGroups[].installMode` is `prefetch` (default, fetches every listed resource at install) or `lazy` (caches what is requested). `updateMode` defaults to `installMode`, and `updateMode: lazy` is valid only with `installMode: lazy`.
- Lazy chunks in a `prefetch` asset group all download at install, which is heavy for large apps. In a `lazy` group they cache on first request. The choice is the user's. The generated `ngsw-config.json` lists only a limited set of font and image extensions.
- `dataGroups[].cacheConfig.strategy` is `performance` (default, cache first, can be stale until `maxAge`) or `freshness` (network first with `timeout`).
- `navigationRequestStrategy` is `performance` (default) or `freshness` (more requests, higher latency, docs prefer the default). `applicationMaxAge` limits how long the app is served from cache.
- Registration default is `registerWhenStable:30000`. Others: `registerImmediately`, `registerWithDelay:<ms>`, a custom Observable. The `updateViaCache` option takes `imports`, `all` or `none`.
- `SwUpdate` offers `checkForUpdate()` and version events. Docs warn that `activateUpdate()` without a reload can mix the old shell with lazy chunks whose filenames changed. Subscribe to `SwUpdate#unrecoverable` for broken clients.
- Stale clients: the worker can serve several versions at once, acts like a long-lived cache, and ignores the usual hard-refresh escape hatch. It verifies file hashes against `ngsw.json` and falls back to safe mode (network) on mismatch. Caching layers between origin and user serving stale content are a listed cause of hash failures.
- Pitfalls to check: long-cached `ngsw.json` or `index.html`, no update prompt wired, `activateUpdate()` without reload, `prefetch` of all lazy chunks on mobile, a CDN serving mixed old and new files mid-deploy.
- If `installMode: prefetch` already fetches all JS, router preloading adds nothing (see `preloading.md`).
- Inspect in DevTools Application, Service Workers and Cache Storage, and the "(ServiceWorker)" source in the Network panel.

## CI gates

- Budgets: `ng build` fails on a budget `error` threshold. Start with warnings, then errors with headroom.
- Bundle diff: save the stats file per build and compare per-chunk sizes between base and PR. The builder emits the file, the comparison is custom. No maintained diff tool for esbuild metafiles was verified. See `measurement-automation.md`.
- Lighthouse CI: `lhci autorun` with assertions. Lab data is noisy, see `measurement-automation.md`.
- Lint: the `angular-eslint` rules listed in `docs-map.md`.

## RUM

- Library: `web-vitals` (6.2.2 on npm). Call `onLCP`, `onINP`, `onCLS` and post to an endpoint. Load it with a dynamic import after bootstrap so it stays off the critical path.
- Field data without instrumenting: CrUX through https://pagespeed.web.dev/ or https://developer.chrome.com/docs/crux, only for public origins with enough traffic.
- The user decides where data goes, consent, and sampling rate.

## Quick, moderate, large

| Size | Options |
|---|---|
| Quick | Verify the production configuration, `statsJson` plus analyzer, warning budgets, check `Cache-Control`, compression and protocol in DevTools, `ngSrc` with `priority` on the LCP image, confirm `ngsw.json` and `index.html` are not long-cached |
| Moderate | Error budgets, `@defer` for heavy blocks, custom preloading strategy, service worker update prompt and `ngsw-config` tuning, Lighthouse CI, RUM, CDN |
| Large | Leave the webpack builder, go zoneless, SSR or SSG with hydration, introduce a service worker, `autoCsp` |

Safe to do without asking (read-only or reversible): read configs, run a build, enable `statsJson`, inspect headers. Ask first: `sourceMap` exposure, `outputHashing` changes, SSR or prerender, removing `zone.js`, enabling a service worker or choosing its lazy chunk policy, CDN and cache rules, RUM destination.

## Unverified, check before relying

- Whether `bundle` and `anyScript` budgets fire on lazy chunks in v22. Lazy chunks carry `entryPoint` in the metafile (seen on 22.1.6), but no budget was tested against one. One temporary run with a low cap would answer it.
- Whether the angular.dev budget defaults (2kb and 4kb for `anyComponentStyle`) are the builder's fallback when thresholds are omitted.
- Whether `preloadInitial` is exposed to users.
- HTTP/2 and HTTP/3 guidance (no verified web.dev article) and CDN specifics.
- Whether 20.x and 21.x share these defaults and the stats file name (`stats.json` seen on 22.1.6).
- `web-vitals` 6.x API signatures and Core Web Vitals threshold numbers. Confirm on https://web.dev/articles/vitals and the README before quoting.
- Whether Lighthouse PWA-related audits still exist in current Lighthouse.
