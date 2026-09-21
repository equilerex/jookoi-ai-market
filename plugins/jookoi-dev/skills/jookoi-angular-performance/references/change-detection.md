# Change detection and runtime cost

Runtime slowness in Angular almost always comes from one of two things: change detection checking more views than it needs to, or each check doing too much work. Fix the second before the first, it's cheaper.

## Per-check cost: templates

- **Function calls with arguments and heavy getters** re-run every time Angular checks that view. In a 500-row `@for` that is 500 calls per cycle. Move the work to `computed()`, a pure pipe, or a field computed when the input changes. Switching a method to a getter changes nothing.
- **Signal reads** (`{{ user().name }}`) are cheap and correct. They are the fix, not the problem.
- **`track`** in `@for`: use a stable id (`track item.id`). `track item` is fine only if object identity survives refetches, which it usually doesn't. `track $index` is fine for static lists and wrong for lists that insert, remove, or reorder.
- **Legacy `*ngFor`** without `trackBy` rebuilds rows on every change. Migrate: `ng generate @angular/core:control-flow`.
- **Long lists**: if the list is hundreds of rows and all of them render, virtualize with CDK `cdk-virtual-scroll-viewport` or paginate. No amount of OnPush fixes 5,000 live DOM rows.

## Number of checks: OnPush and signals

- **v22+**: OnPush is the default. Look for components that explicitly opt back into eager checking and ask whether each needs it.
- **Before v22**: add `changeDetection: ChangeDetectionStrategy.OnPush`, leaf components first. A component that mutates its own fields from a subscription or timer will stop updating: fix by moving that state into a signal, or `markForCheck()` as a stopgap.
- State: `signal`, `computed`, `linkedSignal`. Async reads: `httpResource()` / `resource()` (cancels stale requests, exposes `value()`, `isLoading()`, `error()`), or `toSignal(obs$)` at the edge. Keep `HttpClient` in services for mutations.
- Subscriptions: prefer `toSignal()` or the `async` pipe. Manual `.subscribe()` needs `takeUntilDestroyed()`.

## Zoneless

Removes zone.js from the bundle (roughly 10-13 KB gzip, practitioner figures, not an official benchmark) and removes the "something async happened, check everything" trigger. Default for new apps since v21.

Migration order for an existing app, don't skip steps:

1. Check third-party libs. Anything that mutates Angular state inside its own callbacks (charts, maps, drag-drop, older UI kits) needs its values surfaced through signals or `markForCheck()`.
2. OnPush everywhere, and the app still works.
3. State that drives templates lives in signals, or is otherwise notified (`async` pipe, `markForCheck()`, input changes, template events).
4. `provideZonelessChangeDetection()` in the app config.
5. Remove `zone.js` from `polyfills` in `angular.json` build **and** test targets.
6. Test flows that rely on timers, websockets, and third-party widgets by hand.

Stale name: `provideExperimentalZonelessChangeDetection` became `provideZonelessChangeDetection` in 20.2. Many 2025-2026 blog posts still use the old one.

## Still on zone.js

When zoneless isn't possible yet:

- `provideZoneChangeDetection({ eventCoalescing: true })` merges change detection for events that bubble through several handlers. One-line win.
- **Zone pollution**: a library polling with `setInterval`, `requestAnimationFrame`, or a websocket triggers app-wide checks on every tick. Initialize it inside `NgZone.runOutsideAngular()` and re-enter with `ngZone.run()` only when the UI must update. Angular DevTools' profiler shows this as a stream of cycles with no user input.

## INP: interaction cost

- Profile the slow interaction in the Chrome performance panel (Angular shows its own track there since v20). Look for one long task after the click.
- Split long tasks: do the visible update first, defer the rest (`setTimeout`, `scheduler.yield()` where supported, `afterNextRender`).
- Move CPU-heavy work (parsing, sorting large data, crypto) to a web worker: `ng generate web-worker`.
- `web-vitals` attribution build (`onINP`) names the element and phase that made INP slow in the field.
