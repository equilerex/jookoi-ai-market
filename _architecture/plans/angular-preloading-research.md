# Angular router preloading research (Angular 20 to 22)

Researched 2026-09-21. `@angular/router` dist-tags at research time: latest 22.1.7, next 22.2.0-rc.0, v21-lts 21.2.23, v20-lts 20.3.31.

## Sources and verification level

| Tag | Source |
|---|---|
| [S1] | angular.dev `guide/routing/customizing-route-behavior` (page states it applies to v22), plus ctx7 `/websites/angular_dev` snippets |
| [S2] | `packages/router/src/router_preloader.ts` on GitHub `main` (read in full). Tags `20.0.0` and `21.0.0` also fetched, both contain `loadComponent` handling. Tags `22.0.0` and `22.1.7` returned 404 (tag naming unknown), so v22 is verified from `main` only |
| [S3] | Angular `CHANGELOG.md` on `main` |
| [S4] | angular.dev `guide/templates/defer` |
| [S5] | angular.dev `ecosystem/service-workers/config` |
| [S6] | npm registry (`npm view`) and GitHub REST API, queried 2026-09-21 |
| [S7] | Source of `mgechev/ngx-quicklink` and `mgechev/ngx-hover-preload` on `master`, read directly |
| [S8] | MDN pages for `Navigator.connection` and `requestIdleCallback` |

Anything without a tag or marked "unverified" is inference or not checked. No claim here comes from memory alone.

## 1. Default (NoPreloading)

Default strategy is `NoPreloading` [S1]. A chunk is requested only when the router needs it:

- `loadChildren`: during route recognition of a navigation whose URL matches into that subtree (before guards/resolvers/activation of the target).
- `loadComponent`: when the matched route is being activated. [S2] comment: "component loading is deferred until route activation".
- `canMatch`/`canLoad` guards run before the load, so a failing guard means no request.

Unverified: exact phase ordering of `loadComponent` relative to resolvers in the recognition pipeline (not read in this pass, `router_preloader.ts` only says "until route activation").

Tradeoff: smallest initial network cost and memory, but each first visit to a lazy route pays a chunk round trip (plus any nested chunk it needs) on the navigation critical path.

## 2. Does Angular recommend always enabling a strategy?

No. [S1] says `PreloadAllModules` "works well for small to medium applications where downloading all modules doesn't significantly impact performance" and larger apps "might benefit from more selective preloading". It also says preloading affects network usage and memory and to weigh connectivity and app size. There is no "always enable" statement in [S1].

- `NoPreloading` fits: data-constrained users, rarely visited or large routes, apps where most sessions touch one or two routes, chunks already tiny.
- Preloading helps: likely next routes, chunk fetch latency visible on navigation, users on good networks.
- Small / medium / large: the small/medium vs large split is Angular's wording only. No numeric thresholds exist in the docs. Measure (section 9) instead of using app size.

## 3. Built-ins and configuration

```ts
import {ApplicationConfig} from '@angular/core';
import {provideRouter, withPreloading, PreloadAllModules, NoPreloading} from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes, withPreloading(PreloadAllModules))],
  // or withPreloading(NoPreloading), which equals omitting withPreloading
};
```

Source for the snippet: [S1] and angular.dev API page for `PreloadAllModules`.

Coverage of `loadChildren` and `loadComponent` [S2]:

- `main`, `20.0.0`, `21.0.0` all handle both. `processRoutes` queues a route if `(loadChildren && !_loadedRoutes && canLoad === undefined) || (loadComponent && !_loadedComponent)`.
- v22: verified on `main` only.
- Version-specific fixes [S3]: 15.2.5 "Ensure Router preloading works with lazy component and static children" (#49571). 20.2.0 "ensure preloaded components are properly activated" (#62502). Whether `loadComponent` preloading existed before 15.2.5 is unverified.
- `canMatch` is not referenced anywhere in `router_preloader.ts` on `main` or `20.0.0` [S2]. Only `canLoad` is checked.

## 4. What PreloadAllModules does

- Start: `RouterPreloader.setUpPreloading()` subscribes to `router.events`, filters `NavigationEnd`, then `concatMap(() => this.preload())` [S2]. So it runs after each completed navigation, including the initial one. [S1]: "immediately after the initial navigation".
- Implementation: `fn().pipe(catchError(() => of(null)))`, i.e. call the loader, swallow errors [S2].
- Recursion: after `loadChildren` resolves it calls `processRoutes` on the loaded routes, so nested lazy routes are fetched transitively. It also descends into static `children` [S2].
- What is loaded: code and route config only (`loader.loadChildren`, `loader.loadComponent`). No guards, resolvers or component activation run. Resolvers are not executed, so preloading does not prefetch data [S2].
- `canLoad`: a route with `canLoad` defined is skipped for `loadChildren`. Comment in source: guards can have side effects so it skips preloading altogether. It is checked only for `loadChildren`, not `loadComponent` [S2].
- `canMatch`: not consulted [S2]. A `canMatch`-protected lazy route is still preloaded. Practical consequence: permission-gated chunks are downloaded for users who cannot use them. Source comment also says code splitting is not a security measure.
- Runs again after every `NavigationEnd`, but already loaded routes (`_loadedRoutes`, `_loadedComponent`) are skipped [S2].

## 5. Costs of preloading everything

Precise statements, separating verified from expected:

- Bytes: every lazy chunk, transitively, for every session, whether or not visited. Wasted bytes scale with (total lazy bytes) minus (bytes of routes the user visits). Verified structurally by [S2] recursion.
- Network contention: preload requests start right after first `NavigationEnd`, which can overlap with images, fonts, API calls and lazy `@defer` chunks. Priority of dynamic `import()` fetches vs other requests is browser-dependent. Unverified here.
- Parse/compile/execute: `import()` evaluates the module (top-level code runs, providers/route objects created). Cost is CPU on the main thread. Magnitude unmeasured here.
- Memory: loaded modules stay resident [S1 mentions memory].
- Slow or metered connections: `PreloadAllModules` has no network check [S2]. `saveData` and `effectiveType` are ignored.
- Nested routes: recursion means one top-level lazy route can pull an entire subtree.
- Large apps: cost grows with route count, that is the reason [S1] recommends selective strategies.
- "Server load": preload requests are extra static file requests (CDN or static host) and egress bytes. They cost app-server or SSR compute only if chunks are served through the app server process. That was not verified for any specific architecture. Preloading does not invoke SSR rendering by itself.
- Failed preload: swallowed silently by `catchError` [S2], so 404s from stale deploys are invisible unless logged.

## 6. Custom PreloadingStrategy with `data: { preload: true }`

Base example is from [S1] (route flag). Extended sketch below combines criteria. It is a design sketch, untested.

```ts
import {Injectable} from '@angular/core';
import {PreloadingStrategy, Route} from '@angular/router';
import {EMPTY, Observable, defer, from, of} from 'rxjs';
import {mergeMap} from 'rxjs/operators';

function whenIdle(timeoutMs = 2000): Promise<void> {
  return new Promise(resolve => {
    const ric = (globalThis as any).requestIdleCallback as
      | ((cb: () => void, o?: {timeout: number}) => number) | undefined;
    ric ? ric(() => resolve(), {timeout: timeoutMs}) : setTimeout(resolve, 200);
  });
}

function networkAllows(): boolean {
  const c = (globalThis as any).navigator?.connection; // Chromium only [S8]
  if (!c) return true;                                  // unknown: decide policy
  if (c.saveData) return false;
  return !/(^|-)2g$/.test(c.effectiveType ?? '');       // 'slow-2g' | '2g'
}

@Injectable({providedIn: 'root'})
export class SelectivePreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (route.data?.['preload'] !== true) return EMPTY;
    if (!networkAllows()) return EMPTY;
    return defer(() => from(whenIdle())).pipe(mergeMap(() => load()));
  }
}
// provideRouter(routes, withPreloading(SelectivePreloadStrategy))
```

Notes:
- Returning `EMPTY`/`of(null)` skips. `load()` triggers fetch [S1, S2].
- The strategy sees every route object with a pending `loadChildren`/`loadComponent`, including nested ones after their parent loads [S2].
- `preload` is invoked once per `NavigationEnd` per not-yet-loaded route. If you return `EMPTY` it will be asked again after the next navigation. Dedupe with a `Set<Route>` if you use async gating [pattern used by both libraries, S7].
- `navigator.connection`: MDN marks it "Limited availability, not Baseline" and it is exposed in workers [S8]. Which browsers lack it was not shown in the fetched excerpt. Unverified beyond "not all major browsers". Always feature-detect and decide the default when absent.
- `requestIdleCallback`: MDN "Limited availability, not Baseline". Fall back to `setTimeout` as both libraries do [S7, S8].
- Permissions: check in the strategy only from already known client state (for example a role signal). Do not run `canActivate`. Do not rely on it for security.
- "Links on the current page" needs a directive plus registry (section 11).

## 7. Trigger models compared

Only "none" and "all" are built in [S1]. Everything else is a custom `PreloadingStrategy`. `data.preload` flag, priority, idle and network checks need only a strategy. Viewport/hover/pointerdown additionally need a directive or listeners that call `RouterPreloader.preload()` (public method in [S2], not marked `@docs-private`).

| Model | Trigger | Hit likelihood | Latency hidden | Bandwidth risk | CPU | Mobile | Complexity | Built-in? |
|---|---|---|---|---|---|---|---|---|
| None | user navigates | n/a | none | none | none | fine | none | yes (default) |
| All (after nav) | first and later `NavigationEnd` | low per chunk | high for visited, wasted for rest | highest | highest | poor on metered | none | yes |
| Marked routes | `NavigationEnd` + `data.preload` | as good as your flags | high for flagged | bounded by flags | bounded | fine | low | strategy only |
| Priority | flag value (e.g. `data.priority`) + ordering/delay | as flags | high | bounded | bounded | fine | low to medium | strategy only |
| Idle | `requestIdleCallback` after nav | same as underlying set | same | same set, less contention | less jank | fine | low | strategy only |
| Network-aware | `navigator.connection` gate | same | same | reduced on slow/saveData | same | good where API exists | low | strategy only |
| Viewport (quicklink) | visible `routerLink` | medium (link visible, not necessarily clicked) | medium to high | moderate | moderate | works with touch since no hover | needs directive | package or DIY |
| Hover | `mouseenter` on `routerLink` | higher | partial (hover to click is usually short) | low | low | weak (see 11) | needs directive | package or DIY |
| Pointerdown/intent | `pointerdown`/`touchstart` | very high | small (tens to a few hundred ms until click) | negligible | low | works for touch | needs directive | DIY |
| Predictive (Guess.js) | analytics model | high in theory | high | low | model in bundle | fine | high, build-time | package, effectively abandoned (11) |

Latency-hidden and hit-likelihood columns are qualitative reasoning, not measured.

## 8. Interaction with @defer, service workers, SSR/hydration

Keep these separate:

- Route preloading: fetches route `loadChildren`/`loadComponent` chunks and config after navigation. Controlled by `withPreloading` [S1, S2].
- `@defer` prefetch: per template block, separate mechanism. Prefetch triggers listed in [S4]: `on idle`, `on viewport`, `on interaction`, `on hover`, `on timer`, `when`. Default prefetch trigger not stated on the page fetched. Router preloading does not preload `@defer` chunks and `@defer` prefetch does not preload route chunks.
- SSR/SSG: [S4] says on the server `@defer` blocks render `@placeholder` and triggers are not invoked, unless incremental hydration with `hydrate` triggers is used. Router preloading is driven by the browser `Router`. Whether `RouterPreloader` runs during SSR was not verified, and preloading is only meaningful for the browser bundle anyway (unverified).
- Service worker: [S5] documents `installMode: prefetch` (fetch all listed resources when caching the version) vs `lazy` (cache only what is requested). The page does not address lazy route chunks specifically. An `assetGroup` with `prefetch` for `/*.js` would download all chunks at install time regardless of router strategy, so router `NoPreloading` would not prevent that. Whether the default CLI ngsw config prefetches JS chunks was not verified here.
- Data prefetch: router preloading never runs resolvers [S2]. Prefetching API data is a separate concern (resolver call, service cache warm-up, `httpResource`), not covered by `PreloadingStrategy`.

## 9. Recommendations

- Every app? No. Default `NoPreloading` is the documented default and is correct for many apps [S1].
- `NoPreloading` better when: chunks are small, sessions are short and single-route, audience is data-sensitive, or routes are permission-gated with `canMatch` (built-in preload ignores `canMatch` [S2]).
- `PreloadAllModules` acceptable when: total lazy bytes are small, audience is on fast networks, few nested lazy levels, no permission-gated chunks, and measurement shows navigations wait on chunk fetches.
- Go selective when: multiple large lazy areas, mixed permissions, mobile/metered users, or a clear small set of likely next routes.
- Measure first:
  1. Lazy bytes total vs visited per session (build stats, e.g. `ng build --stats-json` output, or the network panel).
  2. Route transition time split: chunk fetch (Network waterfall) vs render vs data.
  3. LCP/INP/TBT before and after enabling, including throttled 4G/CPU 4x profile.
  4. Preload hit rate: fraction of preloaded chunks the session later visits (custom logging in the strategy).
  5. Field connection mix if available (`effectiveType`, `saveData` counts).
  6. Cache behavior (repeat visits, service worker).
  Enable only if transition time drops without regressing 3.

## 10. Code-review decision guide

- Is `withPreloading(PreloadAllModules)` added with no measurement? Ask for lazy bytes and hit rate.
- Any lazy route behind `canMatch` while using `PreloadAllModules` or a permissive custom strategy? Chunk downloads for unauthorized users. Use `data.preload` flags or a permission-aware strategy.
- `canLoad` used? Preloading of `loadChildren` is skipped for it [S2]. Confirm that is intended.
- Custom strategy: feature-detects `navigator.connection` and `requestIdleCallback`? Dedupes routes? Returns `EMPTY` not `undefined`? Handles errors (`catchError`)?
- Nested lazy trees: does flagging the parent pull the whole subtree?
- Does the strategy assume preloading fetches data? It does not [S2].
- Service worker `prefetch` group defeats a restrictive router strategy. Check `ngsw-config.json`.
- Third-party package: peer range matches the Angular major (section 11), directive imported where links live.

## 11. Third-party strategies

### Strategy vs package

The strategy is a small class (`PreloadingStrategy`) deciding whether to call `load()`. The package parts are the trigger mechanism (directive with `IntersectionObserver` or `mouseenter`), a registry of URL trees, and the wiring to `RouterPreloader.preload()`. Both mgechev libraries follow exactly this structure [S7]:

1. Directive on `[routerLink]` registers the link's `urlTree` in a registry and schedules `loader.preload()` via `requestIdleCallback`.
2. `preload()` re-walks the whole route config. Strategy returns `load()` only for routes whose full path matches a registered tree, and `EMPTY` otherwise.

### ngx-quicklink

- Mechanism [S7]: `IntersectionObserver` on `routerLink`s (`ObservableLinkHandler`), then `requestIdleCallback`, then strategy. If `IntersectionObserver` is unsupported the alternative `PreloadLinkHandler` registers all links immediately (README: "preloads all links on the page").
- Data saver: verified in `quicklink-strategy.service.ts`. It returns `EMPTY` if `navigator.connection` exists and `effectiveType` includes `'2g'` (covers `2g` and `slow-2g`) or `saveData` is true. Also skips `route.data.preload === false`. Limits: 3g and 4g are not gated. If `navigator.connection` is missing (see [S8], not Baseline) there is no check and it preloads. The claim "respects data-saver/slow connections" is therefore true only where the Network Information API exists, and "slow" means 2g only.
- Standalone: exports `quicklinkProviders`, `QuicklinkModule`, `QuicklinkDirective`, `QuicklinkStrategy` [S7 `public-api.ts`]. The `projects/ngx-quicklink/README.md` on master only shows the NgModule setup. Standalone usage instructions are not in the README I read (a commit "Update readme with standalone usage" exists at 2025-12-05, root README not read). Exact standalone wiring is unverified.
- `loadComponent` and `loadChildren`: the strategy calls the `load()` given by the router, which handles both per [S2]. Not tested in the library's own tests here (unverified beyond that).
- Compatibility [S6]: `0.4.8` peers `@angular/core ^20.0.0`. `0.4.9` peers `^21.0.0`. `0.4.10` peers `>=22.0.0`. Each version therefore matches one Angular major. Install the version matching your major. `master` `package.json` still shows 0.4.9 / ^21, so 0.4.10 source was not inspected.
- Activity [S6]: 0.4.10 published 2026-08-06. 0.4.9 2025-12-05. 0.4.8 2025-07-28. Repo not archived, pushed 2026-08-06, 757 stars, 26 open issues. Maintained, mainly by bumping to each Angular major.
- Touch/mobile: viewport-based, no hover dependency, so works on touch. Cost is preloading targets for visible links regardless of intent.
- Accidental hover: none, trigger is visibility. Overfetch risk instead (visible but never clicked, e.g. footer/nav links all in viewport on desktop).
- Bandwidth/CPU: bounded by visible links, idle-scheduled. The author's own comparison says quicklink "does more aggressive preloading compared to `ngx-hover-preload`, which makes it more network and CPU intensive" [S7 README of hover-preload].
- Dependency risk: tiny (`tslib` only), but the per-major peer pinning forces an upgrade in lockstep with Angular majors.
- Known implementation limits visible in source: registry is a module-global array that only grows. `containsQueryParams` has a `TODO` for array params [S7].

### ngx-hover-preload

- Mechanism [S7]: directive on `[routerLink]` with `(mouseenter)` host listener, then `requestIdleCallback`, then strategy.
- Standalone: README shows `provideRouter(routes, withPreloading(HoverPreloadStrategy))` with `hoverPrefetchProviders`, and says to import `HoverPrefetchLinkDirective` where wanted [S7 README].
- Compatibility [S6]: peers `@angular/core >=9.0.0`, `@angular/common >=9.0.0`, so the range admits 20 to 22. Actual behavior on 20 to 22 is untested by me (unverified). It injects `RouterLink` optionally and reads `urlTree`, which is not verified against v22 `RouterLink` API.
- Activity [S6]: last release 0.0.5 on 2024-11-27, last commit the same day. Not archived, 177 stars, 0 open issues. No release for Angular 20/21/22. Effectively dormant, small enough to fork.
- Touch/mobile: only `mouseenter`. No `focus`, no `touchstart`/`pointerdown` handling in source [S7]. Whether a tap synthesizes `mouseenter` on mobile browsers is unverified. Do not rely on it.
- Accidental hover: yes. Any cursor pass over a link triggers preload immediately (idle-scheduled), no dwell delay in source [S7].
- Network-aware: no. No `saveData`/`effectiveType` check in the strategy [S7].
- Bandwidth/CPU: low, only hovered links. The README calls out that it fits after a predictive model as a fallback [S7].

### Guess.js

- Mechanism [S7 README of guess-js, S6]: build-time model from Google Analytics data plus a webpack plugin, prefetching bundles predicted for next navigation. Non-webpack workflow uses a client script calling a server.
- npm [S6]: `guess-parser` 0.4.22 last modified 2022-05-04, `guess-webpack` same date. `guess-plugin` package name does not exist. GitHub repo not archived and reports a 2026-09-18 push, but the three latest commits on the default branch are from 2021 to 2022, so the push is likely elsewhere (unverified what).
- Standalone / loadComponent / Angular 20-22: no evidence. Webpack-plugin based, the Angular CLI default builder in current versions is esbuild-based (not verified here in docs, treat as likely incompatible). Treat as abandoned for Angular 20 to 22.
- Requires analytics data pipeline, highest complexity.

### Other libraries

Web search surfaced only blog patterns for network-aware strategies (Medium/DEV posts) and the two mgechev packages. `ngx-preloader` 0.0.3 peers `^12.1.0`, last modified 2022-05-10, dead [S6]. No other currently maintained package found. Search coverage was one query, so this is not exhaustive.

### Trigger model comparison for third-party options

| | quicklink | hover | Guess.js | DIY equivalent |
|---|---|---|---|---|
| Trigger | viewport + idle | mouseenter + idle | model per navigation | any |
| Hit likelihood | medium | higher | high | depends |
| Latency hidden | medium to high | partial | high | depends |
| Bandwidth risk | moderate (visible links) | low | low | you control |
| CPU | moderate | low | model cost | you control |
| Mobile | good | weak | ok | pointerdown covers touch |
| Version compat | strict per major | loose peers, dormant | none | none |
| Dependency risk | low but lockstep | dormant | abandoned | none |

### Is DIY simple?

Yes for the strategy and directive. Each library is on the order of 100 lines plus a copied URL-tree matching helper [S7]. What you need:

1. A `Set<string>` or set of `UrlTree` for "wanted" links, or simply a `Set<Route>` if you resolve the route yourself.
2. A standalone directive `[routerLink]` that on a chosen event (`pointerdown`, or `pointerenter` after a dwell timer, or `IntersectionObserver`) adds `routerLink.urlTree` to the registry and calls `inject(RouterPreloader).preload().subscribe()`.
3. A strategy that maps `Route` to full path and checks the registry. This is the non-trivial bit (`findPath` and `containsTree` in [S7], about 80 lines). Simplification: skip path matching and key the registry by route `path` or by a `data.preloadKey` you set explicitly.
4. Network gate (section 6 helper) and dedupe.

The hard part is the route to URL matching, including params, outlets and nested lazy children, not the trigger.

When a dependency is worth it: you want viewport-based preloading on a supported major, accept lockstep peer upgrades, and do not want to own the matching code (ngx-quicklink). Otherwise `data.preload` + idle + network gate covers most cases with no dependency. Prefer DIY when you need pointerdown/touch or dwell-delay hover, because neither package provides them. Avoid Guess.js for Angular 20 to 22.

## 12. Contradictions with the existing skill

- "PreloadAllModules for small apps": Angular says small to medium apps where download does not significantly impact performance [S1]. No size thresholds. It also ignores `canMatch` and network state [S2]. Overstated as a blanket default.
- "ngx-quicklink or data.preload custom strategy for large apps": quicklink is viewport-based (registers visible links only), not a large-app tool per se. It pins to one Angular major per version [S6]. Fine as an option, but not "the" large-app answer.
- "quicklink respects data-saver": true per source [S7] but partial. Checks only `saveData` and `2g`, and only where `navigator.connection` exists.
- Hover package is dormant since 2024-11 and desktop-hover only [S6, S7].

## Proposed skill content

### Replacement for SKILL.md ranked fix #7 (one line)

`7. Preloading: keep NoPreloading (default) unless measurement shows route-chunk waits on likely-next routes, then use a selective withPreloading strategy (data.preload flag, idle, saveData/effectiveType gate) rather than PreloadAllModules, which ignores canMatch and network state and fetches every lazy chunk transitively. See references/preloading.md.`

### Outline for `references/preloading.md`

```md
# Route preloading

## What it does
- Default NoPreloading: chunks load at navigation (loadChildren at recognition, loadComponent at activation).
- Preloading fetches code/config only after NavigationEnd. Never runs guards or resolvers, never prefetches data.
- Applies to loadChildren and loadComponent (Angular 20, 21, verified on main for 22). Recurses into nested lazy routes.
- canLoad blocks loadChildren preload. canMatch is NOT consulted. Gated chunks get downloaded.

## Decision guide
1. Measure first (below). No evidence of chunk-wait on navigation: keep NoPreloading.
2. Small lazy total, fast audience, no gated chunks, few nesting levels: PreloadAllModules is acceptable.
3. Otherwise selective: flag likely-next routes (data.preload) + idle + network gate.
4. Want link-driven targeting: DIY directive on routerLink (pointerdown or hover dwell or viewport) calling RouterPreloader.preload().
5. Third-party packages: only ngx-quicklink is maintained (one version per Angular major, viewport + idle, skips 2g/saveData only where navigator.connection exists). ngx-hover-preload dormant since 2024-11, desktop mouseenter only. Guess.js abandoned.

## When NOT to preload
- Data-sensitive or metered audience, tiny sessions, chunks already small.
- Permission-gated lazy routes (canMatch) with a permissive strategy.
- SW config already prefetches all JS (installMode: prefetch), router strategy is moot.
- Preload competes with LCP resources: never start before LCP.

## Strategy table
| Model | Built-in | Needs directive | Notes |
| none | yes | no | default |
| all | yes | no | ignores canMatch, network |
| marked (data.preload) | no | no | ~10 lines |
| idle | no | no | requestIdleCallback + timeout fallback |
| network-aware | no | no | feature-detect navigator.connection |
| viewport | package | yes | ngx-quicklink or DIY |
| hover / pointerdown | package/DIY | yes | pointerdown covers touch |
| predictive | abandoned | build step | Guess.js |

## Minimal custom strategy
(Paste SelectivePreloadStrategy from research section 6.)

## Not to confuse
- @defer prefetch (on idle/viewport/interaction/hover/timer/when) is per template block, separate.
- Router preloading does not run resolvers or fetch API data.
- SSR: @defer triggers do not run on the server. Service worker installMode may prefetch chunks independently.

## Measurement steps
1. Lazy bytes total vs bytes visited per session (build stats / network panel).
2. Navigation timing split: chunk fetch vs render vs data, on throttled 4G + 4x CPU.
3. LCP/INP/TBT before/after.
4. Log preload hit rate from the strategy (preloaded vs later visited).
5. Check ngsw-config.json and CDN caching.
6. Keep only if transition time improves and 3 does not regress.
```
