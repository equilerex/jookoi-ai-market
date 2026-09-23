# Runtime performance

Interaction and rendering cost after load: profiling, long tasks and INP, RxJS, forms, big lists, ExpressionChanged errors, memory leaks, animations and `content-visibility`. Facts come from angular.dev, web.dev, MDN, Chrome docs and Angular, RxJS and CDK source. OnPush, zoneless and template cost live in `change-detection.md`. HTTP and resource loading live in `data-loading.md`. Measuring workflow overall lives in `measuring.md`.

## Triage

| Symptom | Section |
|---|---|
| Slow click or tap (INP) | Profiling, Long tasks, RxJS |
| Slow typing in forms | Forms, RxJS |
| Scroll jank, huge lists | Big lists, `content-visibility` |
| Memory grows over time | Memory leaks, RxJS |
| Console NG0100 | ExpressionChanged |

## Profiling workflow

- INP at p75: good is 200 ms or less, poor is above 500 ms. An interaction is input delay plus processing duration plus presentation delay (web.dev). Start from field data (CrUX, PageSpeed Insights, RUM), then reproduce in the lab by interacting while the page is busiest, usually during load.
- Angular DevTools Profiler: record, and each bar is one change detection cycle. Taller is slower. Selecting a bar shows components, total time and estimated fps. "Show only change detection" grays skipped OnPush components. Profiles save as JSON.
- Chrome Performance panel Angular track: call `ng.enableProfiling()` in the console or `enableProfiling()` from `@angular/core` at bootstrap. Dev mode only. Blue is your TypeScript (services, constructors, hooks), purple is your templates, green is the entry point that explains why code ran. Multiple synchronization passes mean state updates during change detection. The page says "available in Angular v22" with no stated minimum version.
- Forced reflow: the DevTools "Forced Reflow" insight, and the Long Animation Frame API field `forcedStyleAndLayoutDuration`. Forced layout is a style write followed by a layout read. Batch reads, then writes. The `afterNextRender` `read` and `write` phases enforce this, so avoid `earlyRead` and `mixedReadWrite`.

| Size | Action | Automate? |
|---|---|---|
| Quick | Record one slow interaction in both tools, note the top component or handler | No. A skill can suggest `enableProfiling()` in dev bootstrap with consent |
| Moderate | Field INP monitoring | User decision |
| Project | Performance budgets and regression checks in CI | User decision |

## Long tasks and INP

- `scheduler.yield()` returns a promise and its continuation runs ahead of other queued tasks. Support: Chrome 129+, Firefox 142+, not Safari. Wrap with a fallback:

```ts
const yieldToMain = () =>
  'scheduler' in globalThis && 'yield' in (globalThis as any).scheduler
    ? (globalThis as any).scheduler.yield()
    : new Promise<void>(r => setTimeout(r, 0))
```

- `setTimeout(0)` sends the continuation to the end of the queue and nested timers get a 5 ms clamp after five levels. web.dev no longer recommends `isInputPending()`.
- `requestIdleCallback` is for low-priority work only. `timeRemaining()` is capped at 50 ms, Safari support is limited, and it is unavailable in Workers. Avoid DOM changes in it.
- `afterNextRender` runs once after the next render, browser only. It suits post-render DOM work and third-party init, not chunking.
- Web workers: `ng generate web-worker <location>`. Unsupported on some platforms such as SSR `platform-server`, so a fallback is needed.
- Yielding inside the Angular zone can trigger extra change detection per chunk. Run the loop with `NgZone.runOutsideAngular` and re-enter once at the end (see `change-detection.md`).

| Size | Action | Automate? |
|---|---|---|
| Quick | Add a yield helper, yield between batches in a click handler, move analytics after paint | Adding the helper yes. Wrapping loops needs the user because side-effect order changes |
| Moderate | Chunk heavy computation with `runOutsideAngular` | Propose |
| Project | Move computation to a Web Worker (structured-clone cost, bundling, SSR fallback) | User decision |

## RxJS pitfalls

- `shareReplay` is `share` with a `ReplaySubject` connector, `resetOnError: true`, `resetOnComplete: false` and `resetOnRefCountZero: refCount`. `refCount` defaults to `false`, so the source is never unsubscribed when subscribers drop to zero, which can leak on long-lived streams. A completed source stays cached forever, an errored one can be retried. For streams that must stop when unobserved use `shareReplay({ bufferSize: 1, refCount: true })`.
- `takeUntilDestroyed()` with no argument needs an injection context (dev-mode assertion). Pass a `DestroyRef` to use it elsewhere, such as in a method or callback.
- `toSignal` subscribes immediately and unsubscribes when the creating context is destroyed. `manualCleanup: true` opts out. `requireSync: true` throws if there is no synchronous emission. Without `initialValue` the signal is `undefined` first. Observable errors rethrow on read. It is forbidden in a reactive context because each call creates a subscription.
- `toObservable` uses an effect and a `ReplaySubject`, so avoid it per list item or in hot paths.
- Flattening (RxJS 7 JSDoc): `switchMap` unsubscribes the previous inner. `exhaustMap` ignores new projections while one runs. `concatMap` queues (concurrency 1). `mergeMap` runs all, with a `concurrent` cap. Mapping these to search (`switchMap`), submit (`exhaustMap`), ordered writes (`concatMap`) and capped parallel work (`mergeMap`) is a common convention, not an official RxJS statement. A wrong `switchMap` on a write can cancel a save.
- `combineLatest` emits nothing until every input emitted once, then on every emission. `debounceTime` drops pending values on a new emission and emits the last one on completion. `distinctUntilChanged` compares to the last emitted value only.

| Size | Action | Automate? |
|---|---|---|
| Quick | `takeUntilDestroyed(this.destroyRef)` on manual subscribes, `refCount: true` on `shareReplay`, `distinctUntilChanged` | Adding cleanup yes when in injection context or a `DestroyRef` exists. Changing flattening operators is a semantic change for the user |
| Moderate | Replace component `subscribe` with `toSignal`, audit `combineLatest` chains | Propose |
| Project | Move feature state to signals or resource APIs | User decision |

## Forms

- `updateOn` (`'change'`, `'blur'`, `'submit'`, default `'change'`) is set per control or inherited from the parent group or array. The model then updates once per blur or submit instead of per keystroke.
- One control change runs validators and emits `valueChanges` and `statusChanges` on that control, then repeats on every ancestor unless `onlySelf`. `FormArray` rebuilds its value by mapping all enabled children, so cost is O(n) per ancestor per change. `push`, `insert` and `removeAt` emit by default and accept `{ emitEvent: false }`.
- Signal Forms are listed Stable in v22 in the comparison guide and need v21+. The overview still calls reactive forms a solid choice for existing apps and stability guarantees.
- Performance effects of `updateOn` and of Signal Forms are not measured in any source read. Do not promise a speedup or a ranking of form APIs.
- Zoneless: form mutation does not trigger change detection by itself, so signals or `markForCheck()` are needed.

| Size | Action | Automate? |
|---|---|---|
| Quick | `emitEvent: false` on bulk programmatic writes, debounce `valueChanges` consumers | Propose |
| Moderate | `updateOn: 'blur'` on heavy fields, split large forms into OnPush child components | User decision because validation timing is a UX change |
| Project | Signal Forms for new forms | User decision |

## Big lists

- `@for` needs a stable `track` id. Replacing `track $index` needs the user to name the id field.
- CDK virtual scroll: `itemSize` is required for the fixed-size strategy. `minBufferPx` defaults to 100 and `maxBufferPx` to 200. `cdkVirtualForTemplateCacheSize` defaults to 20 views and `0` disables the cache. `cdkVirtualForTrackBy` receives the data-source index. Autosize is in `@angular/cdk-experimental`, documented as not ready for production, and `scrollToIndex` is unsupported there. For `<tr>` or `<li>` the wrapping parent must add no margin or padding. `appendOnly` keeps items in the DOM after they scroll out.
- Virtual scroll changes find-in-page, accessibility semantics and variable-height handling.

| Size | Action | Automate? |
|---|---|---|
| Quick | Stable `track`, pure pipes or `computed` instead of template method calls | Propose |
| Moderate | Pagination or load more, CDK viewport with fixed item height | User decision |
| Project | Server-side pagination and filtering, grid with row virtualization | User decision |

## ExpressionChanged (NG0100)

Dev mode only. Angular runs an extra check after each change detection run, and the error fires when a binding value changed after it was checked. Causes: a getter or method returning a different value per call, a child changing parent values, `ngAfterViewInit` or `ngOnChanges` writes, async loading state. Fixes: set initial values in the constructor or `ngOnInit` (or use `ngAfterContentInit`), keep bound methods free of side effects, stop children from mutating parent bindings. The Chrome Angular track shows multiple synchronization passes for the same pattern.

## Memory leaks

Chrome procedure (two snapshots):

1. Warm up the page, then take snapshot 1 (Memory panel, Heap snapshot). Snapshots start with garbage collection and include only objects reachable from the global object.
2. Do the suspect action, reverse it, and repeat a few times (for example navigate to a route and back).
3. Take snapshot 2, switch its view to Comparison against snapshot 1, and inspect added objects and retainers. Use the "Detached" filter for detached DOM trees.

Typical Angular sources: manual `subscribe` without cleanup, `addEventListener` and `setInterval` without removal, chart or map instances never destroyed. Clean up with `takeUntilDestroyed` or `DestroyRef.onDestroy`. Scanning code for these is a safe report. Automatic rewriting is not.

## Animations

- `animate()` from `@angular/animations` is deprecated since v20.2 (per the API entry). The package docs recommend native CSS with `animate.enter` and `animate.leave` for new code.
- Legacy and new APIs can coexist in an app but not in the same component, and content projection across the two is not supported. `animate.leave` needs `animationComplete()` for callbacks and has `MAX_ANIMATION_TIMEOUT`. Child leave animations fire only within the same component template.
- Respect `prefers-reduced-motion`. Use `grid-template-rows` for auto-height transitions.
- Migration is per component and needs visual verification, so it is not safe to automate fully. Moving to `animate.enter` and `animate.leave` is a user decision. Removing `@angular/animations` app-wide is a project.

## `content-visibility`

`content-visibility: auto` skips rendering of off-screen subtrees. The web.dev demo shows a 7x rendering boost on initial load. Off-screen content stays in the DOM and accessibility tree, so find-in-page still works. Without `contain-intrinsic-size` (for example `auto 300px`) skipped elements lay out at zero height and the scrollbar jumps. DOM APIs that force rendering on a skipped subtree defeat the skip. Support started at Firefox 125 and Safari 18. This is a Moderate change for long static sections. Verify with a trace before and after.

## Where to read more

- https://web.dev/articles/inp and https://web.dev/articles/optimize-long-tasks
- https://angular.dev/best-practices/profiling-with-chrome-devtools and https://angular.dev/tools/devtools/profiler
- https://angular.dev/ecosystem/rxjs-interop and https://angular.dev/api/core/afterNextRender
- https://angular.dev/guide/forms/signals/overview and https://angular.dev/ecosystem/web-workers
- https://material.angular.dev/cdk/scrolling/overview
- https://angular.dev/guide/animations and https://angular.dev/guide/animations/css
- https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots
- https://web.dev/articles/content-visibility
- https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing

## Unverified, check before relying

- Colors of the native Chrome flame chart outside the Angular track, and Angular track availability before v22.
- Any measured speedup from `updateOn`, Signal Forms, or batching with `emitEvent: false`.
- The official RxJS operator decision tree (JSDoc was used instead).
- AG Grid performance options (`getRowId`, row and column virtualization).
- Animating `transform` and `opacity` versus layout properties, and the bundle savings of removing `@angular/animations`.
- The three-snapshot heap technique (not in Chrome's docs, so not described here).
