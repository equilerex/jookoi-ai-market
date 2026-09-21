# Loading speed and Core Web Vitals

Thresholds are "good" at the 75th percentile of real page views: **LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1** (web.dev). INP replaced FID in March 2024.

## Initial bundle

- **Lazy routes**: `loadComponent: () => import('./x/x').then(m => m.X)` or `loadChildren` for route groups. Only the landing route stays eager.
- **Eager code importing lazy code** is the usual reason lazy routes don't shrink main. A shared service or a barrel (`features/admin/index.ts`) imported from `app.config.ts` pulls the whole feature in. Find it in `stats.json`: the module shows up under the initial chunk.
- **Non-tree-shakable deps**: `lodash` (use `lodash-es` per-function or native), `moment` (use `Intl`, `date-fns`), full icon sets, CommonJS packages. The CLI warns about CommonJS deps, don't silence the warning with `allowedCommonJsDependencies` without checking the size.
- **`@angular/animations`** is legacy since v20.2 (native `animate.enter` / `animate.leave`). If still used, `provideAnimationsAsync()` at least loads it lazily.
- **Budgets**: see `measuring.md`.

## `@defer`

```html
@defer (on viewport; prefetch on idle) {
  <app-sales-chart [data]="sales()" />
} @placeholder (minimum 300ms) {
  <div class="chart-skeleton"></div>
} @loading (after 150ms; minimum 400ms) {
  <app-spinner />
}
```

- Triggers: `on idle` (default), `on viewport`, `on interaction`, `on hover`, `on immediate`, `on timer(2s)`, `when <expr>`. `prefetch` takes the same triggers and only downloads.
- Dependencies inside the block must be standalone and not referenced elsewhere in the same file, or they stay in the parent chunk. Check the build output for the new lazy chunk.
- Size the placeholder like the final content, or it shifts layout.
- Don't defer what's in the initial viewport on a client-rendered app. On SSR, use hydrate triggers instead (below).
- Nested blocks with the same trigger load simultaneously, which defeats the point.

## Preloading

- Small apps: `withPreloading(PreloadAllModules)`.
- Large apps: preloading everything competes with the initial load. Use a custom `PreloadingStrategy` that reads `route.data?.['preload']`, or `ngx-quicklink` (preloads routes whose links are in the viewport, respects data-saver).

## Images (LCP, CLS)

`NgOptimizedImage` (`ngSrc`) enforces `width`/`height` (or `fill`), lazy-loads by default, generates `srcset` with an image loader, and warns in dev mode when the LCP image lacks `priority`.

- `priority` on the LCP image only: sets `fetchpriority="high"`, eager loading, and under SSR emits a preload link.
- Configure a loader for your image CDN (`provideImgixLoader`, `provideCloudinaryLoader`, custom) so `srcset` points at resized images.
- Add `<link rel="preconnect">` to the image CDN origin.

## Fonts and CSS

- Production builds inline Google Fonts CSS and critical CSS by default (`optimization.fonts.inline`, `optimization.styles.inlineCritical`). Check they aren't turned off.
- Self-hosted fonts: `font-display: swap`, preload only the one or two faces used above the fold.
- Third-party scripts (analytics, chat widgets, tag managers) are a common LCP and INP cost. Load them after first render or on interaction.

## SSR, prerendering, hydration

Worth it for content, SEO, and e-commerce routes. Behind a login it adds server cost for little LCP gain.

- Per-route render mode via `provideServerRendering(withRoutes(serverRoutes))` (v20+):
  ```ts
  export const serverRoutes: ServerRoute[] = [
    { path: '', renderMode: RenderMode.Prerender },
    { path: 'product/:id', renderMode: RenderMode.Server },
    { path: 'account/**', renderMode: RenderMode.Client },
  ];
  ```
  v19 used `provideServerRouting(serverRoutes)`.
- `provideClientHydration()` is required, otherwise the client throws away the server DOM and re-renders it. It enables HTTP transfer cache (no duplicate GETs), event replay, and incremental hydration by default. Opt out of the latter with `withNoIncrementalHydration()`.
- Incremental hydration: server renders the `@defer` content, the client hydrates it later:
  ```html
  @defer (hydrate on viewport) { <app-reviews /> } @placeholder { <div class="reviews-skeleton"></div> }
  ```
  Hydrate triggers: `on viewport`, `on interaction`, `on hover`, `on idle`, `on immediate`, `on timer`, `when`, and `hydrate never` for static content. This is how to defer above-the-fold content without CLS.
- Hydration mismatches: invalid HTML nesting (`<div>` in `<p>`), direct DOM manipulation, and third-party scripts touching the DOM before hydration. Run browser-only code in `afterNextRender`. `ngSkipHydration` on a component is an escape hatch, not a fix.

## Service worker

`ng add @angular/pwa` caches the app shell and assets for fast repeat visits and offline support. Worth it for frequently revisited apps. Plan cache invalidation (`SwUpdate`) before shipping.
