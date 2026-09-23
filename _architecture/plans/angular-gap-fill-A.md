# Angular perf advisor: gap-fill research A

Researched 2026-09-21. [V] = read in a fetched source (raw GitHub file or page); [U] = unverified. Angular CLI/schematics/docs were read from the `main` branch (latest tag seen: v22.2.0-rc.0; `@angular/build` package.json on main has a placeholder version), NOT from 20.x/21.x tags, so defaults may differ in older versions. WebFetch pages are summarizer output, marked "(summary)". Raw sources are under `raw.githubusercontent.com/angular/angular-cli/main/` (abbrev. CLI:), and `.../angular/angular/main/` (abbrev. NG:).

## 1. Shared code across lazy chunks (application builder)

- [V] The builder always sets esbuild `splitting: true` for the browser bundle, with `chunkNames: options.namedChunks ? '[name]-[hash]' : 'chunk-[hash]'` (CLI:packages/angular/build/src/tools/esbuild/application-code-bundle.ts, ~line 653). Splitting is disabled only via the internal `disableCodeSplitting` option (unit-test builds), line ~76.
- [V] esbuild architecture doc (https://raw.githubusercontent.com/evanw/esbuild/main/docs/architecture.md, "Code splitting"): "a given piece of code is only ever in one chunk"; "the target of each dynamic `import()` expression is considered an additional entry point"; the combination of entry points that reach a code part decides its chunk, so parts reachable from two entries go to a shared chunk, parts reachable from one stay in that entry's chunk. Shared code is NOT duplicated.
- [V] Consequence from that doc: a module used by 2+ lazy routes goes to a shared chunk (`chunk-<hash>.js`); a module used by the initial entry and a lazy entry stays in the initial bundle (reachable from main = loaded up front) [the second half is inferred from the entry-point-combination rule, U as an explicit doc statement].
- [V] Shared chunks that have no exported symbols but have side effects still get import statements (architecture.md).
- [V] Output file names: `outputHashing` all/bundles gives `[name]-[hash]` for entry bundles, else `[name]` (CLI:.../builders/application/options.ts ~line 340).
- [U] What `[name]` resolves to for a pure shared chunk with `namedChunks: true` (esbuild's `chunkNames` doc section was truncated in the fetch). Verify in a real metafile.
- [U] Exact heuristics of how a "common" chunk grows as routes are added: follows from the rule above but no source quantified it.
- [V] esbuild splitting only works with ESM output and `outdir` (esbuild API page, summary).

## 2. Budgets: `bundle` type on lazy chunks, raw vs compressed, generated defaults

- [V] Application builder calls `generateBudgetStats(browserMetafile, outputFiles, initialFiles)` then `checkBudgets(...)` (CLI:.../builders/application/execute-build.ts ~lines 300-307). Only browser output is analyzed (server bundles are skipped).
- [V] `generateBudgetStats` (CLI:.../tools/esbuild/budget-stats.ts) builds "chunks" from every `.js` and `.css` output file: `names = initialRecord?.name ?? getChunkNameFromMetafile(metafile, file)`, `initial = !!initialRecord`. `getChunkNameFromMetafile` returns a name only if `metafile.outputs[file].entryPoint` exists, derived from the entry point file basename minus `.ts/.js`, with `/` `\` `.` replaced by `-` (`getEntryPointName`, utils.ts).
- [V] `bundle` budget: matches chunks whose `names` include the budget `name` (CLI:packages/angular/build/src/utils/bundle-calculator.ts, BundleCalculator). So `bundle` budgets work under esbuild only for outputs that have a metafile `entryPoint` (main, polyfills, styles, and named entries). Whether lazy `import()` chunks carry a metafile `entryPoint` (and so get a name) is [U]; the source does not say. Test with a `bundle` budget on a known lazy chunk and read `browser-stats.json` `outputs[...].entryPoint`.
- [V] Angular docs describe `bundle` as "the size of a specific bundle ... including a lazy-loaded bundle", with `name` (NG:adev/src/content/tools/cli/build.md, line ~89-99). Docs do not say how the name maps under esbuild.
- [V] Budgets compare RAW bytes, not compressed: `asset.size` comes from `outputFile.size`, which is `contents.byteLength` (CLI:.../tools/esbuild/bundler-files.ts, lines 62-63, 89-90, 124-125). Angular docs never state this (page summary confirmed no statement). The build table's "Estimated transfer size" is separate: `calculateEstimatedTransferSizes` uses `brotliCompress` (utils.ts) and is computed only when scripts or style minify is on; it is display-only, not used for budgets (execute-build.ts ~line 318).
- [V] `initial` budget = sum of chunks with `initial: true` (JS and CSS). `anyComponentStyle` uses assets with `componentStyle` taken from esbuild metafile entries flagged `ng-component` (budget-stats.ts), size = `entry.bytes` (raw, after bundling).
- [V] Generated `angular.json` (CLI:packages/schematics/angular/application/index.ts lines ~264-290, production configuration ~315): `strict` option default is `true` (application/schema.json line 113-116), so a fresh app gets:
  - `initial`: warning 500kB, error 1MB
  - `anyComponentStyle`: warning 4kB, error 8kB
  - `strict: false` variant: `initial` 2MB/5MB, `anyComponentStyle` 6kB/10kB
  - Production config sets only `budgets` and `outputHashing: 'all'`. Development config sets `optimization: false`, `extractLicenses: false`, `sourceMap: true`.
- [V] Docs disagree with the template: angular.dev build page says `anyComponentStyle` defaults warn 2kb / error 4kb and `initial` 500kb/1mb (NG:adev/src/content/tools/cli/build.md, line 89). Those doc defaults are the builder's when a budget entry omits thresholds [U: not confirmed in builder source]; template values (4kB/8kB) are what a new project actually has. Use the project's angular.json.
- [V] Budget schema default: `budgets` default is `[]` (application schema.json).

## 3. Defaults: outputHashing, namedChunks, optimization, sourceMap, stats

From CLI:packages/angular/build/src/builders/application/schema.json (main) and the schematic template above.

- [V] `outputHashing`: schema default `none`; values `none|all|media|bundles` (`bundles` = "lazy and main bundles", `media` = images/fonts referenced in CSS). Generated production config sets `all`. Development has no hashing (default `none`).
- [V] `namedChunks`: schema default `false` ("Use file name for lazy loaded chunks"); the template does not set it in either config.
- [V] `optimization`: schema default `true`. Object form: `scripts` (default true), `styles` (true; object with `minify` true, `inlineCritical` true, `removeSpecialComments` true), `fonts` (true; object with `inline` true). Template production config does not set it (so all on); development sets `optimization: false`.
- [V] `sourceMap`: schema default `false`; object form has `scripts` true, `styles` true, `hidden` false, `vendor` false, `sourcesContent` true. Template: production not set (off), development `true`. Consequence: a default production build ships no source maps.
- [V] Flag name: schema option is `statsJson` (default false, "Generates a 'stats.json' file which can be analyzed with https://esbuild.github.io/analyze/."), so CLI flag is `--stats-json` [V for the option name; the kebab-case flag mapping is the standard CLI convention, U as a literal doc quote].
- [V] Where it is written: the application builder writes `browser-stats.json` (and `server-stats.json` when SSR) via `executionResult.addOutputFile(..., BuildOutputFileType.Root)` (execute-build.ts ~lines 393-406). `Root` files have type directory `''` (builders/application/index.ts `generateFullPath`), i.e. the output base (`dist/<project>/browser-stats.json`), not the `browser/` subfolder. It is `JSON.stringify(browserMetafile)`, i.e. the esbuild metafile itself. This corrects the earlier `stats.json` guess; file name is `browser-stats.json` on main [V]. Whether 20.x used the same file name is [U].

## 4. `inlineCritical` and `fonts.inline`

- [V] `inlineCritical` runs the `beasties` library (Critters successor) with `preload: 'media-script'`, `noscriptFallback: true`, `inlineFonts: true`, `pruneSource: false`, `mergeStylesheets: false`, and a CSP nonce picked up from an `ngCspNonce` attribute (CLI:.../utils/index-file/inline-critical-css.ts).
- [V] Beasties doc for `media-script` (https://raw.githubusercontent.com/danielroe/beasties/main/packages/beasties/README.md, "PreloadStrategy" and CSP section): deferred `<link rel="stylesheet">` are left as `media="print"` with the real media in `data-beasties-media`, one small inline script at the end of `<body>` restores them, and a `<noscript>` copy of the original link is added. Unlike the older `media` strategy (`onload`), no inline event handler is used, so it works with CSP nonce/hash. Critical CSS = rules matching elements in the HTML at build time, inlined in `<style>`.
- [V] Beasties README: "A font is critical when the critical CSS declares its family, and, for a face with a `unicode-range`, when the document's text contains a character that face covers"; critical fonts are inlined/preloaded per its `fonts`/`inlineFonts` settings. Angular passes `inlineFonts: true` (so this applies) [V]; whether the version bundled in Angular 20/21 has the same font logic is [U].
- [V] Implication: critical CSS extraction only sees the static `index.html` (or prerendered HTML); elements rendered later by the client are not seen [inferred from the "match elements in the HTML" description, U as an explicit statement]. In a CSR app `index.html` is nearly empty, so critical CSS covers little beyond the shell.
- [V] `optimization.fonts.inline` (CLI:.../utils/index-file/inline-fonts.ts): fetches only the CSS from `fonts.googleapis.com` and `use.typekit.net` at build time via `https.get` (Windows Chrome UA so Google omits hinted fonts, "20-50% larger"), replaces the matching `<link rel="stylesheet">` with `<style>...</style>`, and injects `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` (or typekit). It does NOT download or self-host font files; `@font-face` `src` URLs still point at gstatic/typekit. Supports `HTTPS_PROXY`; a non-200 response fails the build (`Inlining of fonts failed ... status code`). Results are cached in the Angular cache dir under `angular-build-fonts` when cache is enabled.

## 5. Image formats and NgOptimizedImage

- [V] (MDN, https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types, summary) AVIF: "much better compression than PNG or JPEG", include fallbacks with `<picture>`. WebP: also much better compression; "AVIF offers slightly better compression, but is not quite as well-supported in browsers and does not support progressive rendering". JPEG: good for lossy stills, good fallback for photos. PNG: precise reproduction, transparency, screenshots/line art. SVG: icons, UI elements, diagrams; prefer the SVG version of icons.
- [V] (web.dev/learn/images/avif, summary) AVIF support: Chrome/Opera 2020, Firefox 2021, Safari 2022. The page gives no percentages; no verified saving figure. Do not quote a percent saving.
- [U] web.dev/articles/serve-images-avif returned 404 (moved); no verified "AVIF is N% smaller" source. Treat as measure-yourself (compare outputs).
- [V] (web.dev/articles/responsive-images, summary) `srcset` with `x` descriptors: providing the 2x image is enough; `w` descriptors + `sizes` for fluid images, browser picks from viewport width and DPR; `sizes` example `(min-width: 600px) 25vw, (min-width: 500px) 50vw, 100vw`. The page does not cover `loading`/`fetchpriority`.
- [V] NgOptimizedImage (NG:adev/src/content/guide/image-optimization.md and `packages/common/src/directives/ng_optimized_image/ng_optimized_image.ts`):
  - `priority` sets `fetchpriority=high`, `loading=eager`, and auto-generates a preload link; dev warning when the LCP element is an image without `priority`; warns on wrong `width`/`height`, distorted aspect ratio, and missing preconnect for the LCP image origin (auto-preconnect works only when the domain is a static literal in the loader argument).
  - `ngSrcset` takes width (`100w`) or density (`1x`) descriptors without file names; it needs a loader that honors `width` to produce different files. Default breakpoints (summary): 16,32,48,64,96,128,256,384,640,750,828,1080,1200,1920,2048,3840 (source constant `FIXED_SRCSET_WIDTH_LIMIT = 1920` seen for fixed srcsets). `sizes` is required with `fill` or responsive layouts; the directive prepends `auto` to `sizes` (summary).
  - Built-in loaders: Cloudflare, Cloudinary, ImageKit, Imgix, Netlify; plus generic loader (no transform, URL = `src`). Angular states it will not add more built-in loaders. Loaders support `loaderParams.transform` for CDN options (docs line 374).
  - Base64: a `data:` `ngSrc` throws a runtime error; `blob:` also throws (source `assertNotBase64Image`, `assertNotBlobUrl`). Base64 placeholder guidance: keep under 4KB, only for critical images.
  - CSS `background-image`: not directly supported; docs give a migration recipe using `fill` inside a positioned container. `<picture>`: "No, but this is on our roadmap" (issue angular/angular#56594).
  - SVG: no SVG-specific handling or doc statement found in `ng_optimized_image.ts` (searched `svg`: no hits) [V for absence in that file]; the docs do not recommend a loader-based approach for vector files, so do not claim NgOptimizedImage optimizes SVG [U whether it should be used with SVG].
- Image format conversion by Angular itself: not offered; format conversion comes from the CDN loader [V by absence in docs; no build-time image pipeline found].

## 6. CSS cost

- [V] Angular Material theming (NG-components repo `guides/theming.md`, https://raw.githubusercontent.com/angular/components/main/guides/theming.md): theme is applied with the `mat.theme` Sass mixin, "will only declare CSS variables for the categories included in the input" (color, typography, density). Density from 0 to -5. No size figures in the guide; the Material prebuilt-vs-custom size claim is [U].
- [V] (primeng.dev/theming, summary) PrimeNG styled mode: "a theme consists of two parts; base and preset"; base = style rules with CSS variables, preset = design tokens (primitive, semantic, component tiers). Presets: Aura, Material, Lara, Nora. `cssLayer` wraps library styles in a `primeng` cascade layer. Unstyled mode and Tailwind mode exist. The page says nothing on CSS size/bundle impact or on-demand loading, so PrimeNG theme cost is [U].
- [V] Tailwind (v4 docs, https://raw.githubusercontent.com/tailwindlabs/tailwindcss.com/main/src/docs/detecting-classes-in-source-files.mdx): Tailwind scans project files as plain text for candidate class tokens and generates CSS only for classes used, "so your CSS is as small as possible". Dynamic class names built by string concatenation are not detected (implied by the plain-text tokens description; explicit doc example not read, U). Multiple stylesheets can each restrict what they include. The v3 `content` config globs are not covered here: [U] for v3.
- [V] Chrome DevTools Coverage (https://developer.chrome.com/docs/devtools/coverage, summary): reports used vs unused bytes of CSS and JS for the recorded session; results only reflect code executed during the recording, code needed for un-triggered interactions shows as unused. Use as a hint only.
- [V] `anyComponentStyle` budget: see section 2 (raw bytes of each component stylesheet, template default 4kB warn / 8kB error).
- [V] Global stylesheet: `optimization.styles.minify` default true; `removeSpecialComments` default true (schema).

## 7. Facades, font fallbacks, subsetting

- [V] Facade definition and libraries (Chrome docs, https://developer.chrome.com/docs/lighthouse/performance/third-party-facades, summary): "A static element that looks similar to the embedded third-party, but is not functional and therefore much less taxing on the page load"; pattern: show facade, preconnect on mouseover, replace with real embed on click. Listed libraries: YouTube `paulirish/lite-youtube-embed`, `justinribeiro/lite-youtube`, `Daugilas/lazyYT`, `ngx-lite-video`; Vimeo `luwes/lite-vimeo-embed`, `slightlyoff/lite-vimeo`; chat `calibreapp/react-live-chat-loader`. Lighthouse flags known deferrable third-party products loaded without a facade. `web.dev/articles/third-party-facades` returns 404 (moved to the Chrome docs URL above).
- [V] Maintenance (npm registry + GitHub API today): `lite-youtube-embed` 0.3.4 (2025-11-10), `@justinribeiro/lite-youtube` 1.9.0 (2025-10-28, repo pushed 2026-04-21), `ngx-lite-video` 1.2.0 last published 2023-04-24 (stale). GitHub API responses for `lazyYT` not checked.
- [V] (web.dev/articles/efficiently-load-third-party-javascript, summary) `async` vs `defer`; preconnect only critical domains (saves 100-500 ms, misuse delays other resources); lazy-load below-the-fold third-party content with IntersectionObserver; self-hosting third-party scripts reduces DNS/round trips and improves caching headers but loses automatic updates/security fixes; service worker caching as a middle path.
- [V] MDN `size-adjust`, `ascent-override`, `descent-override`, `line-gap-override` (https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/css/reference/at-rules/@font-face/): `size-adjust` is a multiplier for glyph outlines and metrics; MDN's own example uses it on a `local()` fallback face "to better match those of a primary web font"; the three override descriptors set ascent, descent and line-gap metrics. Baseline "widely available since Sept 2023" (from earlier research, not re-read here, U).
- [V] `fontaine` 0.8.2 (npm, modified 2026-09-15; repo unjs/fontaine pushed 2026-09-21, not archived): "Automatic font fallback based on font metrics", generates metrics and overrides, reduces CLS via local font fallbacks (README). It is a bundler plugin (Vite/Webpack/Nuxt style); an Angular esbuild builder integration is [U] (no source found). `@capsizecss/core` 4.1.3 (2025-11-12; repo seek-oss/capsize pushed 2026-09-15): computes font metric overrides; `@capsizecss/metrics` and `@capsizecss/unpack` exist (README). Both usable to precompute the `@font-face` fallback CSS by hand. Next.js `next/font` does the same automatically (`adjustFontFallback`, default true for Google fonts, default `'Arial'` for local fonts; also self-hosts Google fonts at build time) (Next.js docs raw `font.mdx`). Not applicable to Angular directly.
- [V] Subsetting tools: `fonttools` `pyftsubset` (repo fonttools/fonttools pushed 2026-09-18, active; options `--unicodes=`, `--flavor=`, `--layout-features=` documented in `Lib/fontTools/subset/__init__.py`); `glyphhanger` 6.0.0 (npm 2026-06-05, repo pushed 2026-06-08, not archived; requires Python + fonttools + brotli; can list unicode-ranges used on a site and subset with them); `subset-font` 2.9.0 (npm, modified 2026-09-20; purpose not read, U). Two repos in the same GitHub API call responses showed `archived: true` with 2021 pushes; these are the fork/template objects nested in responses, not the top-level repos (top-level fields are as listed).
- [V] (web.dev/articles/font-best-practices, summary) use WOFF2 only ("Use only WOFF2 and forget about everything else"); WOFF2 about 30% better than WOFF; `unicode-range` lets the browser download only needed subsets; preload fonts with caution; `font-display: optional` (no layout shift), `swap` (fast text, possible jarring swap), `block`; self-host vs third-party performance difference is "ambiguous" and self-hosting needs a CDN and HTTP/2 to compete.
- [V] (developers.google.com/fonts/docs/material_symbols, summary) Material Symbols payload: 295 KB default (all 3,800+ icons), 1.7 KB with `icon_names` subsetting, 7.9 MB full variable axes, 2.6 KB with subsetting plus fixed axes.

## 8. Heavy libraries

- lodash vs lodash-es: [V] npm `lodash-es` 4.18.1: `"type": "module"`, `"sideEffects": false`, `"module": "lodash.js"` (npm registry metadata); `lodash` main is CommonJS `lodash.js`. lodash.com lists `lodash-es`, `babel-plugin-lodash`, `lodash-webpack-plugin`, custom builds and per-method packages, and says you can cherry-pick methods (`require('lodash/at')`) (summary). Prior finding retained: per-method packages discouraged. Angular CLI also emits a warning for CommonJS dependencies [V, build page summary]. Whether `import { x } from 'lodash-es'` fully tree-shakes in an esbuild Angular build: expected from `sideEffects:false` and ESM, [U] until checked in `browser-stats.json`.
- moment: [V] moment docs webpack page (https://raw.githubusercontent.com/moment/momentjs.com/master/docs/moment/00-use-it/08-webpack.md): "Moment uses a dynamic locale lookup, so Webpack includes every Moment locale by default ... It also produces the largest bundle"; options are `ContextReplacementPlugin` (allowlist) or `IgnorePlugin` (`/^\.\/locale$/` with context `moment`) to remove the dynamic lookup. Both are webpack plugins. The Angular application builder is esbuild, so these do not apply; esbuild's behavior on moment's dynamic locale `require` is [U] (check `inputs` in `browser-stats.json` for `moment/locale/*`). Alternatives verified as existing on npm: `date-fns` 4.4.0 (2026-05-29), `luxon` 3.7.2 (2025-09-05, slow release cadence), `moment` 2.31.0 (registry modified 2026-09-15; project in maintenance mode per earlier research). No sizes verified.
- Icon sets:
  - [V] Angular Material `mat-icon` supports ligature font icons (Material Symbols), CSS-class font icons (Font Awesome style), and SVG via `MatIconRegistry` (`addSvgIcon`, HTML strings) (NG-components `src/material/icon/icon.md`). You must add the font's CSS/HTML yourself. Material Symbols font size figures in section 7 (295 KB default down to 1.7 KB with `icon_names`).
  - [V] (primeng.dev/icons, summary) PrimeIcons "over 250" icons (358 listed); each icon is a standalone Angular component rendering inline SVG imported from `@primeicons/angular`, "Import them individually for optimal tree-shaking, or use the named exports from the package root"; PrimeIcons is optional, any icon can be templated. npm `@primeicons/angular` exists (8.0.1, 2026-09-08). Whether the older CSS-font `primeicons` package is still shipped by default in a PrimeNG 22 setup: [U].
  - [V] (lucide.dev/guide/packages/lucide-angular, summary) icons are standalone Angular components; "Only the icons you use are included in your final bundle". npm `lucide-angular` 1.0.0 (2026-05-15) declares `sideEffects: false` and peer deps `@angular/core` and `@angular/common` `13.x-21.x`, so Angular 22 is NOT declared in its peer range [V, npm]; docs page does not mention Angular 22.
- Angular locale data:
  - [V] (NG:adev/src/content/guide/i18n/import-global-variants.md) Initial install includes `en-US` locale data only; `ng build --localize` includes locale data and sets `LOCALE_ID` automatically; global variants are in `@angular/common/locales/global` and can be imported in `main.ts`. Locale files live in `@angular/common`.
  - [V] (format-data-locale.md) pipes use the `LOCALE_ID` token; the `locale` parameter on a pipe overrides it.
  - [U] Whether each `@angular/common/locales/<code>` import (with `registerLocaleData`) adds only that locale to the bundle (expected; verify by searching `browser-stats.json` inputs for `@angular/common/locales`). Not documented in the guides read.
  - [V] `@angular/localize` (NG:.../i18n/add-package.md): needed for `i18n` builds; `ng add @angular/localize`; `--use-at-runtime` puts it in `dependencies` so `$localize` can be used at runtime. Runtime `$localize` bundle cost is [U]. If the app does not use i18n or `$localize`, the package should not be imported (inference, U).

## Proposed skill content (verified facts only)

### 1. Shared chunks
- The application builder always runs esbuild with `splitting: true`; lazy chunks are `chunk-<hash>.js`, or `<name>-<hash>.js` with `namedChunks: true`.
- esbuild treats each dynamic `import()` target as an entry point; code reachable from several entry points is moved into ONE shared chunk (never duplicated), code reachable from one stays in that chunk.
- A big shared chunk means the same heavy module is imported by 2+ lazy routes or by a barrel. Diagnose with `browser-stats.json` inputs, not by guessing.
- Fix options: lazy-load the heavy module on demand behind its own `import()`, split barrel imports, or accept it because it is shared once.

### 2. Budgets
- Budgets compare raw output bytes; the build table's "estimated transfer size" is brotli and display-only.
- `initial` sums JS+CSS of initial chunks; `anyComponentStyle` checks each component stylesheet's raw bytes.
- `bundle` budgets match by `name` against the entry-point-derived name from the esbuild metafile; test on the specific lazy chunk before relying on it.
- New app template (strict): `initial` 500kB/1MB, `anyComponentStyle` 4kB/8kB; non-strict: 2MB/5MB and 6kB/10kB. angular.dev quotes 2kb/4kb for component styles: always read the project's `angular.json`.

### 3. Defaults
- `outputHashing`: schema `none`, generated production `all`. `namedChunks`: `false`. `optimization`: `true` (scripts, styles minify, inlineCritical, fonts inline all on). `sourceMap`: `false` (dev config turns it on).
- Analysis flag: `ng build --stats-json` (option `statsJson`); writes `browser-stats.json` (and `server-stats.json` with SSR) at the output base (`dist/<project>/`), an esbuild metafile that opens in esbuild.github.io/analyze.

### 4. Critical CSS and fonts
- `inlineCritical` uses Beasties with `media-script` strategy: full stylesheet link becomes `media="print"` + `data-beasties-media`, restored by one inline script, with a `<noscript>` fallback; CSP-friendly via `ngCspNonce`.
- Critical CSS is computed from the HTML present at build time (little in a pure CSR shell).
- `optimization.fonts.inline` inlines only the Google Fonts/Adobe Fonts CSS into `index.html` (needs network at build; fails on non-200) and adds preconnect; it does not download or self-host font files.

### 5. Images
- Prefer AVIF or WebP over JPEG/PNG for photos with `<picture>` fallback; SVG for icons/diagrams (MDN). AVIF support: Chrome 2020, Firefox 2021, Safari 2022 (web.dev). Do not quote percent savings.
- Use `srcset` with `w` descriptors plus `sizes` for fluid images; 2x only for fixed size.
- `NgOptimizedImage`: `priority` on the LCP image only (adds fetchpriority high, eager, preload), `ngSrcset` for custom widths, `fill` for background-style images, loaders for Cloudflare/Cloudinary/ImageKit/Imgix/Netlify; no `<picture>`, no `background-image`, no `data:` or `blob:` `ngSrc`. Format conversion must come from the CDN.

### 6. CSS
- Material: `mat.theme` emits CSS variables only for the categories you pass (color, typography, density).
- PrimeNG: theme = base + preset tokens; `cssLayer` option; unstyled and Tailwind modes exist; theme cost not documented.
- Tailwind v4 generates only classes found by plain-text scanning; avoid building class names dynamically.
- Use Chrome DevTools Coverage only as a hint (reflects recorded interactions only). Enforce with `anyComponentStyle` budget.

### 7. Third-party and fonts
- Facade pattern: static lookalike, preconnect on hover, real embed on click (Chrome Lighthouse docs). Libraries: `lite-youtube-embed` 0.3.4 (2025-11), `@justinribeiro/lite-youtube` 1.9.0 (2025-10), `lite-vimeo-embed`; `ngx-lite-video` is stale (2023).
- Other third-party guidance: preconnect only to critical origins, lazy-load below-the-fold embeds, self-hosting trades update convenience for cache control.
- Font fallback: `size-adjust`, `ascent-override`, `descent-override`, `line-gap-override` on a `local()` fallback `@font-face` reduce swap shift; compute values with Capsize (`@capsizecss/core`, active) or Fontaine (active, bundler-plugin oriented).
- Use WOFF2 only; subset with `pyftsubset` or `glyphhanger` (both maintained); `unicode-range` for multi-script fonts; `font-display` choice per priority; Material Symbols via `icon_names` drops 295 KB to about 1.7 KB.

### 8. Heavy libraries
- Prefer `lodash-es` (ESM, `sideEffects: false`) with named imports, or `lodash/<method>` direct paths; avoid `lodash` root import and per-method packages; the CLI warns on CommonJS deps.
- moment bundles every locale by default under webpack; the documented fixes are webpack-only, so measure in the esbuild build and consider `Intl`, `date-fns` or `luxon`.
- Icons: use SVG/standalone-component icons (`@primeicons/angular`, `lucide-angular`) or subset the Material Symbols font; `lucide-angular` 1.0.0 peer range stops at Angular 21.
- Locales: `en-US` ships built in; register only needed locales from `@angular/common/locales`; `ng build --localize` handles data and `LOCALE_ID` for multi-locale builds; `@angular/localize` is only needed for i18n.

## Still unverified
- Lazy `import()` chunk names/`entryPoint` in the metafile (affects `bundle` budgets); `[name]` for shared chunks.
- Whether 20.x/21.x differ from `main` (all CLI source read from `main`); `browser-stats.json` name in older versions.
- Material prebuilt theme size, PrimeNG theme size, Tailwind v3 `content` config.
- AVIF/WebP percent savings; SVG handling by NgOptimizedImage.
- Fontaine integration for Angular; `subset-font` scope.
- esbuild handling of moment locales and lodash-es tree-shaking in the Angular builder; per-locale bundling of `@angular/common/locales`; `@angular/localize` runtime cost.
