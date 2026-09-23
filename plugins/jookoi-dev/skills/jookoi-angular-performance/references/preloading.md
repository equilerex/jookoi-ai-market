# Route preloading

Verified against Angular Router source (`router_preloader.ts`) on `main`, tags 20.0.0 and 21.0.0, and the libraries' sources. v22 is verified from `main` only. Full notes: `_architecture/plans/angular-preloading-research.md`.

## What it does

- Default is `NoPreloading`: `loadChildren` loads during route recognition, `loadComponent` at activation. The cost is a chunk wait on first navigation to a lazy route.
- Preloading fetches code and route config after `NavigationEnd`, including the first one. Recurses into nested lazy routes. Never runs guards or resolvers, never fetches API data, never activates anything.
- Covers `loadChildren` and `loadComponent` (verified 20, 21, `main`). Older fixes: 15.2.5 (lazy component with static children), 20.2.0 (preloaded components activate properly).
- `canLoad` blocks `loadChildren` preloading. `canMatch` is **not** consulted, so gated chunks download for users who cannot enter the route. Not a security boundary either way.
- Only `NoPreloading` and `PreloadAllModules` are built in. Everything else is a custom `PreloadingStrategy`. `PreloadAllModules` swallows load errors.
- Extra cost is static/CDN requests for chunks, plus parse/compile CPU and memory once loaded. It is not application-server or SSR compute unless chunks are served that way.

## Decision guide

1. **Measure first** (below). No evidence of chunk wait on likely-next routes: keep `NoPreloading`. Angular does not recommend always enabling a strategy and gives no size threshold.
2. Small total lazy size, fast audience, no permission-gated lazy routes, shallow nesting: `PreloadAllModules` is acceptable.
3. Otherwise selective: flag likely-next routes with `data.preload`, start on idle, gate on network.
4. Link-driven targeting (hover, viewport, pointerdown): needs a directive calling `RouterPreloader.preload()` plus a strategy. See "Packages vs DIY".
5. If the project already has a strategy or package, review it against this guide. Do not swap it unprompted.

## When not to preload

- Metered or data-sensitive audience, short sessions, chunks already small.
- `canMatch`-gated lazy routes with a permissive strategy.
- Service worker already prefetches all JS (`installMode: prefetch`): router preloading adds nothing.
- Anything that would start before LCP finishes.

## Strategies

| Trigger | Built in | Needs directive | Notes |
|---|---|---|---|
| none | yes | no | default |
| all after navigation | yes | no | ignores `canMatch` and network |
| marked (`data.preload`) | no | no | ~10 lines |
| idle | no | no | `requestIdleCallback` with `setTimeout` fallback |
| network-aware | no | no | feature-detect `navigator.connection` (Chromium only) |
| link in viewport | package | yes | ngx-quicklink or DIY |
| hover / pointerdown | DIY (hover package is dormant) | yes | `pointerdown` also covers touch |
| predictive (history) | no | build step | Guess.js is abandoned |

### Minimal custom strategy

Design sketch, untested. Dedupe with a `Set<Route>` if gating asynchronously: `preload` is asked again for every not-yet-loaded route after each `NavigationEnd`.

```ts
@Injectable({ providedIn: 'root' })
export class SelectivePreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (route.data?.['preload'] !== true || !networkAllows()) return EMPTY;
    return defer(() => from(whenIdle())).pipe(mergeMap(() => load()));
  }
}
// provideRouter(routes, withPreloading(SelectivePreloadStrategy))

function whenIdle(timeoutMs = 2000): Promise<void> {
  return new Promise((resolve) => {
    const ric = (globalThis as any).requestIdleCallback;
    ric ? ric(() => resolve(), { timeout: timeoutMs }) : setTimeout(resolve, 200);
  });
}

function networkAllows(): boolean {
  const c = (globalThis as any).navigator?.connection;
  if (!c) return true; // unknown: decide policy
  return !c.saveData && !/(^|-)2g$/.test(c.effectiveType ?? '');
}
```

Permissions: only read already-known client state (a role signal). Do not run guards from the strategy.

## Packages vs DIY

- **ngx-quicklink**: maintained. One release line per Angular major (0.4.8 peer `^20`, 0.4.9 `^21`, 0.4.10 `>=22`), so upgrades are lockstep. Preloads routes of links in the viewport, after idle. Skips only when `saveData` or `effectiveType` contains "2g", and only where `navigator.connection` exists. Elsewhere it preloads with no check. Standalone wiring not verified from its README (NgModule setup shown).
- **ngx-hover-preload**: last release 2024-11-27, `mouseenter` only, no touch, no dwell delay, no network check. Compatibility with 20-22 untested. Treat as dormant.
- **Guess.js**: webpack-based, npm packages last touched 2022. Do not recommend.
- **DIY** is small: a standalone directive on `routerLink` that on `pointerdown` (or hover after a dwell timer, or `IntersectionObserver`) registers the link and calls `inject(RouterPreloader).preload()`, plus a strategy that checks the registry. The hard part is matching a `Route` to a URL (params, outlets, nested lazy children). Shortcut: key by route `path` or an explicit `data.preloadKey`.
- A dependency is worth it mainly for viewport-based preloading without owning the matching code. Prefer DIY for `pointerdown`/touch or dwell-delay hover, since neither package provides them.

## Not the same thing

- `@defer` `prefetch` triggers are per template block. `@defer` triggers do not run on the server.
- Router preloading does not run resolvers or fetch data. Data prefetch is separate.
- A service worker `installMode` may fetch chunks on its own schedule. Check `ngsw-config.json` before adding router preloading.

## Measure before deciding

1. Total lazy bytes vs bytes actually visited per session (build stats, network panel).
2. Navigation time split into chunk fetch, render, data, on throttled 4G with 4x CPU.
3. LCP, INP, TBT before and after.
4. Preload hit rate: log preloaded vs later visited routes from the strategy.
5. Service worker and CDN caching config.
6. Keep only if transition time improves and step 3 does not regress.
