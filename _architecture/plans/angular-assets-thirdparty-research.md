# Angular non-JS load cost: images, fonts, CSS, third-party scripts

Research date 2026-09-21. Sources fetched this session (page version not stated by pages unless noted). Angular docs were read from angular.dev "latest" (no explicit 20/21/22 tag on the pages). Anything marked UNVERIFIED was not confirmed in a fetched source and must be checked before it goes into the skill. Not covered by a fetched source: Angular Material/PrimeNG theme cost, Google Tag Manager/consent specifics, Angular zoneless + third-party interplay, `<picture>` art direction workaround, image format savings numbers, AVIF/WebP support. All those are UNVERIFIED here.

## 1. NgOptimizedImage

Source: https://angular.dev/guide/image-optimization , https://angular.dev/api/common/NgOptimizedImage

Facts (verified from source):
- Stable since Angular 15 (backported to 13.4 and 14.3).
- `ngSrc` replaces `src`. `width` and `height` are required (intrinsic size) unless `fill`.
- Non-`priority` images get `loading=lazy`. `priority` sets `fetchpriority=high`, `loading=eager`, and generates a preload hint. Priority images default `decoding=sync`.
- `fill`: no width/height, parent needs `position: relative|fixed|absolute`. Documented as the migration path for `background-image`.
- `ngSrcset` takes width descriptors (`100w, 200w`) or density descriptors. `sizes` documented as combinable with ngSrcset; docs say `"auto"` is prepended automatically (exact semantics: read the API page before quoting).
- Automatic srcset generation happens only with a non-default loader. `disableOptimizedSrcset` turns it off per image.
- Built-in loaders: Cloudflare Image Resizing (`provideCloudflareLoader`), Cloudinary, ImageKit, Imgix, Netlify. Default generic loader returns URL unchanged (no resizing). Custom loader via `IMAGE_LOADER` token: receives `ImageLoaderConfig` (`src`, `width`, `height`, `loaderParams`), returns absolute URL.
- `loaderParams` passes CDN options; `transform` supported by Cloudinary, Cloudflare, ImageKit, Imgix (not Netlify).
- `placeholder`: needs a loader (else error), default 30px resolution (`IMAGE_CONFIG.placeholderResolution`), blur on by default (`placeholderConfig`). Data-URL placeholders allowed; docs recommend under 4KB.
- Preconnect: auto link generated for domains passed to a loader. Other origins: add `<link rel="preconnect">` manually. Suppress dev warning via `PRECONNECT_CHECK_BLOCKLIST`.
- Limits: no direct `background-image` support; `<picture>` support "on our roadmap"; inline base64/SVG not optimized (docs only mention data-URL placeholders; SVG statement UNVERIFIED as an explicit doc claim).
- Dev-mode warnings (LCP image without priority, oversized image, missing preconnect): described in the docs as dev-only checks. Exact list UNVERIFIED (not extracted).

Measure: Lighthouse/PSI LCP element + "Properly size images", DevTools Network (Priority column, transferred size), Angular dev-mode console warnings.

Options:
- Quick win: add `priority` to the single LCP image; add width/height; `ngSrc` swap on plain `<img>` (safe, mechanical, but user must confirm which image is LCP).
- Moderate: configure a CDN loader + `sizes`; enable placeholder; preconnect to image origin.
- Project: move image hosting to an image CDN or build-time pipeline; replace CSS background hero images with `fill` img; art direction via `<picture>` (outside NgOptimizedImage, UNVERIFIED best approach).

Risk: `priority` on many images defeats itself (rule of thumb; UNVERIFIED as a doc quote). `fill` without positioned parent collapses the image. Loader choice = vendor lock-in/cost, user decision.
Automate safely: adding `width/height` only when intrinsic size is known; NOT choosing priority or CDN.

## 2. Image formats and responsive sizing
Not fetched from an authoritative source this session. Candidates to verify: web.dev "Serve images in modern formats", MDN image types guide, web.dev responsive images. All claims about AVIF/WebP savings and support are UNVERIFIED. Angular-side lever: CDN loader `transform` (e.g. format auto) handled by the CDN, not by Angular.

## 3. Fonts

Sources: https://web.dev/articles/optimize-webfont-loading , https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/size-adjust , https://angular.dev/reference/configs/workspace-config , https://web.dev/articles/optimize-cls

- Angular builder: `optimization.fonts.inline` default true; inlines external Google Fonts and Adobe Fonts CSS into index.html at build (reduces render-blocking request). Does not download font files or self-host them (implied by description; the actual font files still come from the CDN: UNVERIFIED).
- Preload critical fonts with `<link rel=preload>` (web.dev). `font-display` values: auto, block, swap, fallback, optional. `optional` avoids re-layout (web.dev CLS article).
- Subsetting: `unicode-range` lets the browser fetch only needed subsets (web.dev). Tooling for subsetting (fonttools, glyphhanger): UNVERIFIED.
- `size-adjust` (MDN): Baseline widely available since Sept 2023; used to rescale a local fallback face. Companion `ascent-override`, `descent-override`, `line-gap-override` listed as related in MDN only via general knowledge: check MDN before quoting. Tools to compute values (Fontaine, Capsize): UNVERIFIED.
- Self-host: web.dev says use HTTP cache with long max-age. Self-hosting benefit versus Google Fonts (cache partitioning): UNVERIFIED.

Measure: Network tab (font requests, timing), Lighthouse "Ensure text remains visible" and "Preload key requests", CLS from Performance panel layout-shift records.
Options: quick = `font-display: swap|optional`, preload the one main woff2; moderate = self-host woff2, subset, fewer weights; project = variable font, size-adjust fallback stack.
Risk: `optional` may leave the fallback font on first visit (brand issue). Preloading unused fonts wastes bandwidth. Needs user decision on brand fonts.

## 4. CSS

Sources: https://angular.dev/reference/configs/workspace-config , https://angular.dev/tools/cli/build

- `optimization.styles.inlineCritical` default true ("Extract and inline critical CSS to improve FCP"), `minify` default true. Inlined critical CSS plus deferred loading of the full stylesheet (mechanism, media=print swap trick): UNVERIFIED in fetched text.
- Budgets (angular.dev build): types initial, bundle, allScript, all, anyComponentStyle, anyScript, any. Docs say `initial` warn 500kb / error 1mb; `anyComponentStyle` warn 2kb / error 4kb (the page states these as defaults; new-project templates may differ, check the workspace's angular.json).
- Global CSS bloat, unused CSS detection (Chrome DevTools Coverage), UI-kit theme cost (Material prebuilt theme vs custom, PrimeNG themes, Tailwind purge): UNVERIFIED, no source fetched. Needs Angular Material theming docs, PrimeNG docs, Tailwind docs.

Measure: build output "Initial Total" split JS/CSS, DevTools Coverage tab, Lighthouse "Reduce unused CSS".
Options: quick = keep inlineCritical on, tighten anyComponentStyle budget; moderate = replace prebuilt UI theme with scoped/custom theme, split global CSS; project = utility-CSS with purge, design-token refactor.
Risk: critical-CSS extraction can mis-detect styles for dynamic content (UNVERIFIED). Removing "unused" CSS blindly breaks dynamic states: user confirms.

## 5. Third-party scripts

Sources: https://web.dev/articles/optimizing-content-efficiency-loading-third-party-javascript , https://partytown.qwik.dev/ , https://angular.dev/api/core/NgZone , https://web.dev/articles/inp , https://web.dev/articles/optimize-long-tasks

- web.dev: always `async` or `defer` unless critical path. `preconnect`/`dns-prefetch` for their origins. Iframe sandboxing isolates them but still blocks `onload`. Self-hosting gives header control but loses vendor updates. Lazy-load non-critical (ads, video) with IntersectionObserver. Measure: throttled Network panel, Lighthouse, WebPageTest domain breakdown, request blocking A/B, PerformanceObserver long tasks.
- Facades: web.dev/articles/third-party-facades returned 404. Facade pattern for YouTube/chat: UNVERIFIED; find current URL (try web.dev/articles/third-party-javascript or the older /third-party-facades path on developer.chrome.com).
- Partytown: site says "still in beta and not guaranteed to work in every scenario"; moves scripts to a web worker; Angular listed in integration guides (details not fetched). Header/sync-XHR requirements UNVERIFIED. Status is beta as of fetch date; treat as experimental.
- `NgZone.runOutsideAngular`: executes fn in the parent zone, avoids change detection triggers. Useful when loading/initializing a vendor SDK whose timers/listeners would trigger CD in zone-based apps. Zoneless behavior: not in the fetched text, UNVERIFIED.
- INP: good <=200ms, poor >500ms at p75 (web.dev/articles/inp); parts: input delay, processing, presentation. Long third-party tasks raise input delay.
- Yielding: `scheduler.yield()` Chrome/Edge 129+, Firefox 142+, Safari unsupported per web.dev at fetch time; fallback `setTimeout`.
- Tag managers, consent gating, load-after-interaction/idle patterns: no source fetched. UNVERIFIED. Angular-side approach for interaction/idle gating: `@defer (on idle|interaction)` gates Angular components only, not arbitrary script tags (inference from defer docs, not a stated doc claim).

Options: quick = add async/defer, preconnect to vendor origin, remove unused tags; moderate = load after idle/consent through a small loader service (outside NgZone), replace embeds with facades; project = self-host/proxy, move to server-side tagging, Partytown trial, governance for tag additions.
Risk: consent laws (user/legal decision), analytics data loss when delaying, chat widgets missing early messages. Never auto-remove vendor tags.

## 6. Resource hints and fetchpriority
Source: https://web.dev/articles/fetch-priority
- `fetchpriority` high/low/auto; hint not directive. LCP image case study: Google Flights 2.6s to 1.9s (vendor case study). Preload = discovery, fetchpriority = ordering. Support: Chrome/Edge 102, Firefox 132, Safari 17.2.
- Most visible on bandwidth-constrained connections. Too many preconnects (limit): UNVERIFIED.

## 7. Video and iframes
Source: https://web.dev/articles/lazy-loading-video
- `loading="lazy"` on video/iframe (web.dev text says poster also lazy; iframe details defer to a separate article, so support level UNVERIFIED for video). `preload="none"` plus `poster`. GIF replacement: `autoplay muted loop playsinline`. Effort: quick win. Risk: below-the-fold only; never lazy-load LCP embed.

## 8. CLS specific to Angular
Sources: https://angular.dev/guide/templates/defer , https://web.dev/articles/optimize-cls
- Defer docs: do not defer components visible in the initial viewport; avoid `immediate`, `timer`, `viewport`, some `when` triggers for such content. `@placeholder (minimum ...)` exists for flicker; `@loading (after; minimum)`. Placeholder must match final dimensions (inference; docs stress avoiding viewport deferral).
- SSR: defer renders only placeholder server-side unless incremental hydration is on.
- CLS threshold: good <=0.1 at p75; >0.25 poor. Causes: images without dimensions, ads/embeds without reserved space (`min-height`/`aspect-ratio`), web fonts (use `optional`, font overrides), non-composited animations, bfcache ineligibility.
- Angular-specific late render: `@if` on async data (resource/httpResource loading state) without skeleton; unverified as documented CLS cause.

## Source disagreements / gaps
- Budget defaults: angular.dev build page says initial 500kb/1mb, component style 2kb/4kb. New-project templates may ship different values (UNVERIFIED; check a generated angular.json).
- Facades page 404.
- ctx7 returned little beyond angular.dev pages; all facts otherwise via WebFetch summaries (small-model summaries; quote-check before publishing).

## Proposed skill content: references/assets-and-third-parties.md

Structure per topic: Symptom -> How to measure -> Options (Quick / Moderate / Project) -> Safe to automate vs needs user -> Pitfalls -> Links.

1. Triage table: LCP element type (img/bg/text/video) -> section.
2. Images: measure (LCP element, Lighthouse, dev-mode warnings). Quick: `priority` on LCP, width/height, `ngSrc`. Moderate: loader + sizes + placeholder + preconnect. Project: image CDN, replace CSS bg with `fill`. Automate: ngSrc swap where dimensions known. User: which image is LCP, CDN vendor. Pitfalls: multiple priority, fill w/o positioned parent, SVG/CSS bg unsupported. Links: angular.dev/guide/image-optimization.
3. Formats/sizing: leave `TODO verify` until sourced.
4. Fonts: measure; quick font-display + one preload; moderate self-host + subset; project variable font + size-adjust fallback; note `optimization.fonts.inline` only inlines CSS. Links: web.dev optimize-webfont-loading, MDN size-adjust.
5. CSS: measure (build output, Coverage); quick keep inlineCritical, set anyComponentStyle budget; moderate custom UI theme; project utility CSS/purge (needs sourcing). Links: angular.dev workspace-config, build.
6. Third parties: measure (blocking A/B, long tasks, INP); quick async/defer + preconnect; moderate idle/consent loader outside NgZone, facades; project server-side tagging, Partytown (beta). User: consent, vendor removal. Links: web.dev third-party article, partytown.qwik.dev, web.dev/inp.
7. Hints: fetchpriority, preconnect, dns-prefetch; do not over-preconnect.
8. Video/iframe: loading=lazy, preload=none, poster.
9. CLS: defer placeholders sizing, skeletons, reserved space, font overrides.
10. Read-more list + "verify before quoting" flags from above.
