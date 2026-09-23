# Images, fonts, CSS and third-party scripts

Non-JS load cost: what the LCP image, web fonts, global CSS, vendor scripts and layout shifts cost, and what to do at three effort sizes. Facts come from angular.dev, web.dev, MDN and the Angular CLI source on `main` (defaults in 20.x and 21.x may differ, so read the project's `angular.json`). For bundle size and lazy chunks see `chunk-size.md`. For `@defer` and chunk loading see `loading.md`. For the measuring workflow see `measuring.md`.

## Triage by LCP element

| LCP element | Start at |
|---|---|
| `<img>` | Images |
| CSS `background-image` | Images (`fill` migration) |
| Text | Fonts, CSS and critical CSS |
| Video or iframe | Resource hints and video |
| Layout jumps, not slow paint | CLS causes |
| Slow interactions after load | Third-party scripts |

## Images

`NgOptimizedImage` (`ngSrc`, stable since Angular 15) is the built-in lever.

- `width` and `height` are required unless `fill` is used. Non-`priority` images get `loading=lazy`.
- `priority` sets `fetchpriority=high` and `loading=eager`, and generates a preload link. Use it on the LCP image only. Dev mode warns when the LCP element is an image without `priority`, on wrong or distorted dimensions, and on a missing preconnect.
- `fill` needs a parent with `position: relative|fixed|absolute` and is the documented migration for `background-image`. `sizes` is required with `fill` or responsive layouts.
- `ngSrcset` takes width (`100w`) or density (`1x`) descriptors. Real resizing needs a loader that honors `width`. The default generic loader returns the URL unchanged.
- Built-in loaders: Cloudflare, Cloudinary, ImageKit, Imgix, Netlify. Custom loaders use the `IMAGE_LOADER` token. `loaderParams.transform` passes CDN options (not on Netlify). Angular does not convert formats, the CDN does.
- `placeholder` needs a loader and defaults to 30px resolution with blur. Data-URL placeholders should stay under 4KB.
- Preconnect is generated automatically only when the loader domain is a static literal. Other origins need a manual `<link rel="preconnect">`.
- Not supported: `background-image`, `<picture>` (on the roadmap, angular/angular#56594), `data:` and `blob:` as `ngSrc` (runtime error). The directive source has no SVG handling, so do not claim it optimizes SVG.

Formats (MDN): AVIF and WebP compress much better than JPEG and PNG. AVIF is slightly smaller than WebP but less widely supported and has no progressive rendering. Use `<picture>` for fallbacks and SVG for icons and diagrams. AVIF support started in Chrome 2020, Firefox 2021, Safari 2022. No verified percent saving exists, so compare outputs on the actual images. Responsive images (web.dev): `x` descriptors for fixed-size images, `w` descriptors plus `sizes` for fluid ones.

| Size | Action | Automate? |
|---|---|---|
| Quick | `priority` on the LCP image, `width`/`height`, swap `src` for `ngSrc` | Swap and dimensions yes when intrinsic size is known. Choosing the LCP image needs the user |
| Moderate | CDN loader, `sizes`, placeholder, preconnect to the image origin | Propose only. Loader choice is vendor lock-in and cost |
| Project | Image CDN or build-time pipeline, CSS background heroes to `fill`, `<picture>` art direction outside `NgOptimizedImage` | User decision |

Pitfalls: `fill` without a positioned parent collapses the image to zero height. A non-default loader with `ngSrcset` only helps if the CDN actually resizes.

Measure: Lighthouse LCP element and "Properly size images", DevTools Network (Priority column, transferred size), dev-mode console warnings.

## Fonts

- `optimization.fonts.inline` (default true) fetches only the CSS from `fonts.googleapis.com` and `use.typekit.net` at build time, replaces the `<link rel="stylesheet">` with `<style>`, and adds a `<link rel="preconnect">` to `fonts.gstatic.com` or typekit. It does not download or self-host font files. `@font-face` `src` URLs still point at gstatic or typekit. The build needs network access and fails on a non-200 response (`HTTPS_PROXY` is supported).
- Use WOFF2 only (web.dev). `unicode-range` lets the browser fetch only needed subsets. Self-host versus third-party speed is "ambiguous" per web.dev, and self-hosting needs a CDN and HTTP/2 to compete.
- `font-display: optional` avoids layout shift but may leave the fallback font on a first visit. `swap` shows text fast with a possible jarring swap.
- Fallback metrics: `size-adjust`, `ascent-override`, `descent-override` and `line-gap-override` on a `local()` fallback `@font-face` reduce swap shift. Compute values with `@capsizecss/core` or `fontaine` (bundler-plugin oriented, no verified Angular integration).
- Subsetting: `pyftsubset` (fonttools) or `glyphhanger` (needs Python, fonttools, brotli). Material Symbols with `icon_names` subsetting drops from 295 KB to about 1.7 KB.

| Size | Action | Automate? |
|---|---|---|
| Quick | `font-display`, preload the one main `woff2` | Only after the user names the critical font. Brand impact of `optional` is theirs |
| Moderate | Self-host `woff2`, subset, drop unused weights | Propose |
| Project | Variable font, computed fallback metrics | User decision |

Pitfalls: preloading unused fonts wastes bandwidth. Self-hosting gives up Google's automatic font updates. Measure: Network (font request timing), Lighthouse "Ensure text remains visible" and "Preload key requests", layout-shift records for CLS.

## CSS and critical CSS

- `optimization.styles.inlineCritical` (default true) runs Beasties with `preload: 'media-script'`. Deferred stylesheet links become `media="print"` with the real media in `data-beasties-media`, one inline script at the end of `<body>` restores them, and a `<noscript>` copy is added. No inline event handler is used, so it works with CSP via the `ngCspNonce` attribute.
- Critical CSS covers rules matching elements in the HTML at build time. In a client-rendered app `index.html` is nearly empty, so little is inlined beyond the shell. Prerendering or SSR gives it real content to match.
- Budgets compare raw bytes, not compressed. A new strict app has `initial` 500kB warning and 1MB error, `anyComponentStyle` 4kB and 8kB. angular.dev quotes 2kb and 4kb for component styles. The project's `angular.json` decides.
- UI kits: Angular Material `mat.theme` emits CSS variables only for the categories passed (color, typography, density). PrimeNG themes are base plus preset tokens with an optional `cssLayer`, and its size cost is not documented. Tailwind v4 generates only classes found by plain-text scanning, so dynamically concatenated class names are not detected.
- Chrome DevTools Coverage reports only code used during the recording, so treat it as a hint. Do not delete "unused" CSS blindly.

| Size | Action | Automate? |
|---|---|---|
| Quick | Keep `inlineCritical` on, tighten the `anyComponentStyle` budget | Budget change is propose only |
| Moderate | Trim theme categories, split global CSS | Propose |
| Project | Utility CSS with scanning, design tokens | User decision |

Measure: build output initial total split into JS and CSS, DevTools Coverage, Lighthouse "Reduce unused CSS".

## Third-party scripts

Long vendor tasks raise INP input delay (good is 200ms or less at p75, poor is above 500ms). See `runtime.md` for profiling and yielding.

- Use `async` or `defer` unless the script is on the critical path. Preconnect only to critical origins (saves 100 to 500 ms, misuse delays other resources). Lazy-load below-the-fold embeds with `IntersectionObserver`.
- Facade: a static lookalike that is not functional, with preconnect on hover and the real embed on click (Chrome Lighthouse docs). Libraries: `lite-youtube-embed` 0.3.4 (2025-11), `@justinribeiro/lite-youtube` 1.9.0 (2025-10), `lite-vimeo-embed`. `ngx-lite-video` was last published 2023-04. Lighthouse flags known deferrable products loaded without a facade.
- Self-hosting a vendor script gives header and cache control but loses automatic updates and security fixes. A service worker cache is a middle path.
- `NgZone.runOutsideAngular` initializes an SDK whose timers and listeners would otherwise trigger change detection in zone-based apps (see `change-detection.md`).
- Partytown moves scripts to a web worker. Its site says it is beta and not guaranteed to work in every scenario.

| Size | Action | Automate? |
|---|---|---|
| Quick | `async`/`defer`, preconnect to the vendor origin | Attributes yes. Removing a tag never |
| Moderate | Load after idle or consent through a small loader service outside `NgZone`, facades for embeds | Propose |
| Project | Proxy or server-side tagging, Partytown trial, tag governance | User decision |

Pitfalls: consent law is a user or legal call. Delaying analytics loses data. Chat widgets miss early messages. Measure: throttled Network panel, request blocking A/B, Lighthouse third-party summary, `PerformanceObserver` long tasks.

## Resource hints and video

- `fetchpriority` (`high`, `low`, `auto`) is a hint. Preload gives discovery, `fetchpriority` gives ordering. Support: Chrome and Edge 102, Firefox 132, Safari 17.2. A Google Flights case study went from 2.6s to 1.9s LCP (vendor case study).
- `preconnect` and `dns-prefetch` are for origins that host critical resources, not for every vendor.
- Video and iframes: `loading="lazy"` for below-the-fold embeds, `preload="none"` with `poster`, GIF replacement with `autoplay muted loop playsinline`. Never lazy-load the LCP embed.

## CLS causes

Good is 0.1 or less at p75, poor is above 0.25 (web.dev).

- Images without dimensions. Fix with `width`/`height` or `aspect-ratio`.
- Ads and embeds without reserved space. Fix with `min-height` or `aspect-ratio`.
- Web fonts swapping. Fix with `font-display: optional` or fallback metric overrides.
- Non-composited animations and bfcache ineligibility.
- `@defer`: do not defer components visible in the initial viewport, and avoid `immediate`, `timer` and `viewport` triggers for them. `@placeholder (minimum ...)` and `@loading (after ...)` reduce flicker. With SSR only the placeholder renders on the server unless incremental hydration is on.

## Where to read more

- https://angular.dev/guide/image-optimization and https://angular.dev/api/common/NgOptimizedImage
- https://angular.dev/reference/configs/workspace-config and https://angular.dev/tools/cli/build
- https://web.dev/articles/font-best-practices and https://web.dev/articles/optimize-webfont-loading
- https://developer.chrome.com/docs/lighthouse/performance/third-party-facades
- https://web.dev/articles/fetch-priority and https://web.dev/articles/optimize-cls
- https://partytown.qwik.dev/

## Unverified, check before relying

- Exact `sizes="auto"` prepend semantics in `NgOptimizedImage` (read the API page).
- Whether `priority` on many images is documented as harmful (rule of thumb only).
- Material prebuilt theme size, PrimeNG theme size, Tailwind v3 `content` config.
- Partytown header requirements and Angular integration details.
- Tag manager and consent-gating patterns, and `@defer` gating arbitrary script tags.
- Behavior of the Beasties version bundled in Angular 20 and 21 (source read from `main`).
