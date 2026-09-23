# Angular runtime performance research (Angular 20-22)

Purpose: material for a general Angular performance advisor skill. Research date 2026-09-21. Docs footer on angular.dev showed v22.1.7.

Legend: [V] = verified in a fetched page (URL given). [U] = unverified, not confirmed by a fetched source in this session (either the fetch returned no usable content, or it was not fetched). Do not treat [U] items as fact; confirm before writing them into the skill.

Sizes: Q = quick win (minutes to a day, low risk), M = moderate (days, local refactor), P = planned project (weeks, needs decision/testing).

## 1. Profiling workflow

### Measure
- INP thresholds at p75: good <= 200 ms, needs improvement 200-500 ms, poor > 500 ms. [V] https://web.dev/articles/inp
- An interaction = input delay + processing duration + presentation delay. [V] same URL. Input delay usually means something else blocked the main thread; processing = your handlers (+ Angular CD run in them); presentation delay = style/layout/paint after handlers. Mapping to Angular is inference, not doc text.
- Field data first (CrUX / PageSpeed Insights / RUM), then reproduce in lab by interacting while the page is busiest (during load). [V] same URL.
- Angular DevTools Profiler: record, each bar = one change detection (CD) cycle, taller = slower; selecting shows components/directives, total CD time and estimated fps (flagged below 60). Flame graph tiles colored by time relative to slowest; "Show only change detection" grays skipped OnPush components. Save profile as JSON. [V] https://angular.dev/tools/devtools/profiler
- Chrome Performance panel Angular track: call `ng.enableProfiling()` in the console or `enableProfiling()` from `@angular/core` at bootstrap. Dev mode only. Colors: blue = your TS (services, constructors, hooks), purple = your templates, green = entry points (why code ran). Multiple synchronization passes indicate state updates during CD. [V] https://angular.dev/best-practices/profiling-with-chrome-devtools. Page says "available in Angular v22"; no explicit minimum version. Earlier-version availability [U].
- Forced reflow: Chrome DevTools "Forced Reflow" insight; Long Animation Frame API exposes `forcedStyleAndLayoutDuration` for field detection. [V] https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing

### Reading a flame chart (advisor heuristic)
- Wide Angular-track purple/blue under a green entry point = CD/scripting cost (Angular or your code). Fix by cutting CD frequency or work per cycle.
- Yellow scripting not under the Angular track = third-party or non-Angular code (unverified color mapping of the native panel [U]; generic DevTools knowledge).
- Purple Recalculate Style / Layout blocks after scripting, or a Layout event nested inside a script frame = style/layout cost or forced reflow. [U] color conventions of native Chrome panel; forced reflow insight itself is [V].
- Many small CD cycles per interaction = zone pollution or multiple event sources.

### Options by size
- Q: record one interaction in Angular DevTools and Chrome panel, note the top component/handler.
- M: add RUM with INP attribution (web-vitals library) [U: library not fetched].
- P: performance budget/regression checks in CI.
- Automatable: none of the profiling itself. A skill can generate the checklist and enable `enableProfiling()` in dev bootstrap only with user consent.

## 2. Long tasks and yielding

### Options
- `scheduler.yield()`: returns a promise, continuation resumes ahead of other queued tasks. Support stated as Chrome 129+, Firefox 142+, not Safari. Use a fallback wrapper (`globalThis.scheduler?.yield ? scheduler.yield() : new Promise(r => setTimeout(r,0))`). [V] https://web.dev/articles/optimize-long-tasks
- `setTimeout(0)` yield: continuation goes to end of queue; nested timers get a 5 ms minimum clamp after five levels. [V] same URL.
- `isInputPending()`: web.dev says it no longer recommends it. [V] same URL.
- `requestIdleCallback`: low-priority work only, `timeRemaining()` max 50 ms, timeout option, limited Safari support, not available in Workers, avoid DOM changes (use rAF). [V] https://developer.mozilla.org/en-US/docs/Web/API/Background_Tasks_API
- `afterNextRender`: runs once after next render, browser-only, phases earlyRead/write/mixedReadWrite/read; prefer `read` and `write` over `earlyRead` and `mixedReadWrite`. It is for post-render DOM work and third-party init, not a general chunking tool. [V] https://angular.dev/api/core/afterNextRender
- Web workers: `ng generate web-worker <location>`; CLI configures project, creates `*.worker.ts`, generates component code. Not supported on some platforms (e.g. SSR `platform-server`), need a fallback. Suited to CPU-heavy work. [V] https://angular.dev/ecosystem/web-workers
- Zone note: `scheduler.yield`/`setTimeout` inside the Angular zone can trigger extra CD per chunk (inference from zone pollution doc; see section 7).

| Size | Action | Risk |
|---|---|---|
| Q | `await yieldToMain()` between loop batches in a click handler; move non-urgent work (analytics) after paint | Low; ordering of side effects may change |
| M | Chunk large computation; `runOutsideAngular` for chunk loop, re-enter zone once at the end | Medium; state consistency |
| P | Move computation to a Web Worker (structured-clone cost, bundling, SSR fallback) | Higher; architecture change |

- Automatable safely: adding a yield helper; wrapping loops is NOT safe to auto-apply (needs user judgment on semantics).

## 3. Forms

### Facts
- Signal Forms: `form(model)`; `[formField]` binding; array fields tracked by identity in `@for` (`track field`). Docs mark it "New" in v22 and require v21+. It states reactive forms remain a solid choice for existing apps or production-stability needs. [V] https://angular.dev/guide/forms/signals/overview. Stable vs experimental label [U] (page did not state it).
- Array identity tracking keeps field references across swaps/sorts; primitives tracked positionally. [V] (ctx7 snippet) https://angular.dev/guide/forms/signals/dynamic-forms-with-json
- Reactive forms: `emitEvent: false` suppresses valueChanges emissions for programmatic updates, `onlySelf: true` avoids parent recalculation; in zoneless apps form mutation does not trigger CD automatically and needs `markForCheck()` or signals. [V] https://angular.dev/guide/forms/reactive-forms and https://angular.dev/guide/zoneless
- `updateOn: 'blur' | 'submit'`: the fetched reactive forms page did NOT cover it. Existence and behavior are [U] here; verify against https://angular.dev/api/forms/AbstractControl before using.
- No source fetched compared reactive vs template-driven vs signal forms performance. Any claim of a speed ranking is [U].

### Pitfalls (mostly [U] as general reasoning)
- valueChanges fan-out: every keystroke walks parent validity up the tree; a subscriber per control re-runs on each. Mitigate with `debounceTime`, `distinctUntilChanged`, `updateOn`, and batching writes with `emitEvent: false` then a single emit.
- Large dynamic forms: many controls each with validators; `patchValue`/`setValue` in a loop emits per control.

### Options by size
- Q: `emitEvent:false` on programmatic bulk writes; debounce valueChanges consumers.
- M: `updateOn: 'blur'` on heavy fields; split form into child components with OnPush.
- P: migrate to Signal Forms for new forms (decision: stability vs benefit).
- User decision needed: any form migration, and validation timing changes (UX change).

## 4. Big lists

### Facts
- CDK virtual scroll options: `itemSize`, `autosize` (experimental), buffer, trackBy/`templateCacheSize`; docs list caveats. [V, shallow] https://material.angular.dev/cdk/scrolling/overview. Detail behavior and exact directive names: [U], read the page directly.
- Signal forms `@for ... track field` for arrays. [V] see section 3.
- AG Grid config options (row virtualization, `getRowId`, column virtualization, `suppress*` flags): not fetched. [U] https://www.ag-grid.com/angular-data-grid/performance/

### Options
- Q: `@for` with a stable `track` id (not index for mutable lists); pure pipes or computed instead of template method calls.
- M: pagination or "load more"; CDK `cdk-virtual-scroll-viewport` with fixed item height.
- P: server-side pagination/filter; heavy grid with row virtualization and server row model.
- Risk: virtual scroll breaks find-in-page, a11y semantics, variable heights (autosize experimental).
- Automatable safely: replacing `track $index` needs the user to pick the id field; not safe unattended.

## 5. RxJS pitfalls

Doc fetches of rxjs.dev returned no content. Everything below in this section not marked [V] is [U] and should be confirmed at https://rxjs.dev/api before including.

- [V] `takeUntilDestroyed` handles auto-unsubscription tied to component/service lifecycle. https://angular.dev/ecosystem/rxjs-interop
- [V] `toSignal` subscribes immediately, unsubscribes on destroy of the calling component/service, needs injection context, has `initialValue`, `requireSync`, `manualCleanup`; errors are thrown when the signal is read. Same URL.
- [V] `toObservable` uses an effect and a `ReplaySubject`; first value may be sync, later values async; only the settled value emits after multiple updates. Same URL. Cost implication: extra effect per call, so avoid in hot loops or per-list-item; inference.
- [U] `shareReplay` without `{bufferSize:1, refCount:true}` keeps the source subscribed forever after first subscriber (leak for long-lived streams). Use `refCount: true` for HTTP-less infinite sources.
- [U] Operator choice: `switchMap` cancels prior inner (search, navigation reads), `exhaustMap` ignores new while busy (submit buttons), `concatMap` queues in order (writes that must all run), `mergeMap` parallel (bounded with concurrency arg). Wrong `switchMap` on writes can cancel saves.
- [U] `combineLatest` storms: N sources emitting at load produce N intermediate emissions; mitigate with `auditTime`/`debounceTime`, `distinctUntilChanged`, or `computed` signals.
- [U] Unsubscribed streams: manual `subscribe` in components without `takeUntilDestroyed`; `async` pipe/`toSignal` preferred.

### Options
- Q: add `takeUntilDestroyed()` to subscribes; `refCount: true` on shareReplay; `distinctUntilChanged`.
- M: replace per-component `subscribe` with `toSignal`; audit `combineLatest` chains.
- P: move state to signals/resource APIs across a feature.
- Automatable safely: adding `takeUntilDestroyed(this.destroyRef)` where in injection context is mechanical; changing flattening operators is a semantic change, user decision.

## 6. Signals pitfalls

- [V] Default equality is `Object.is`; `computed` accepts a custom equality function to avoid propagation when objects are logically equal. https://angular.dev/guide/signals
- [V] Docs advise against writing state inside effects; use `linkedSignal` for derived writable state; effects are for non-reactive API side effects. Same URL.
- [V] `untracked()` for reads that should not create a dependency; reactive context only covers synchronous code, reads after `await` are not tracked. Same URL.
- [U] Granularity: one large `computed` over a big object re-runs for any dependency; split into small computeds. Reasoning, not from a fetched source.
- Options: Q replace effect-that-sets-signal with `computed`/`linkedSignal`; M add equality function to heavy computeds; P restructure state into fine-grained signals.
- Effects that write state can be safely flagged by lint/grep, but the rewrite needs review.

## 7. Change detection, zone, pure pipes

- [V] Zone pollution: timers, rAF, listeners from third-party libs trigger CD without data changes; fix with `NgZone.runOutsideAngular()`, re-enter with `ngZone.run()` when a callback must update UI. https://angular.dev/best-practices/zone-pollution
- [V] Runtime performance page headings: zone pollution, slow computations, skipping subtrees (OnPush), Chrome profiling. https://angular.dev/best-practices/runtime-performance
- [V] Zoneless stated as default in v21+; verify `provideZoneChangeDetection` is not overriding. CD triggers: `markForCheck`, `setInput`, signal reads in templates, bound listeners. `NgZone.onMicrotaskEmpty/onStable/isStable` never fire zoneless (use `afterNextRender`/`afterEveryRender`). `provideCheckNoChangesConfig({exhaustive: true})` helps catch missed notifications. https://angular.dev/guide/zoneless
- SOURCE DISAGREEMENT: the runtime-performance page footer says v22.1.7 while user projects may be 20; zoneless default (v21+) means Angular 20 apps still ship zone.js by default. Confirm project version first.
- ExpressionChangedAfterItHasBeenChecked: not covered by any fetched page. [U] Typical cause: state changed in a child/hook after parent was checked; dev-mode-only check. Use Angular DevTools profiler multiple-pass indicator [V: Chrome track "multiple synchronization passes"].
- [V] Pure pipes run only when primitive input or reference changes; impure pipes carry "significant performance penalty"; mutations to arrays/objects not detected by pure pipes. https://angular.dev/guide/templates/pipes
- Options: Q `runOutsideAngular` for charts/maps/polling loops, replace template method calls with pure pipe or computed; M OnPush on hot components; P zoneless migration (needs removing NgZone stability hooks, testing changes). Zoneless is a user decision.

## 8. Memory leaks

- [V] Heap snapshot: Memory panel, Heap snapshot, Take snapshot. Summary view groups by constructor; Comparison view diffs two snapshots ("Objects allocated between Snapshot 1 and 2"); Retainers show what holds an object; can filter for objects retained by detached nodes. https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots
- Workflow (composed): warm up, snapshot 1, repeat suspect action N times (navigate to a route and back), force GC, snapshot 2, compare, inspect `Detached` DOM and retainers. Three-snapshot technique specifics [U] (page fetch did not show it).
- Leak sources: [U] as reasoning: listeners added via `addEventListener` without removal, `setInterval`, unsubscribed RxJS (section 5), chart/map instances not destroyed (call `destroy()`/`remove()` in `DestroyRef.onDestroy`), long-lived service caching component refs.
- Options: Q `takeUntilDestroyed`, `DestroyRef.onDestroy` cleanup; M route-navigation leak test with heap snapshots; P memory budget test in CI (Puppeteer/Playwright) [U].
- Automatable: scanning for `subscribe(`, `addEventListener`, `setInterval` without cleanup is safe as a report; automatic rewriting is not.

## 9. Animations

- [V] `animate()` from `@angular/animations` deprecated since v20.2; use `animate.enter`/`animate.leave`. Source: ctx7 API entry for https://angular.dev/api/animations/animate. Also [V] "The @angular/animations package is deprecated. The Angular team recommends using native CSS with animate.enter and animate.leave for animations in all new code." https://angular.dev/guide/legacy-animations/complex-sequences (ctx7).
- SOURCE DISAGREEMENT: the fetch of https://angular.dev/guide/animations returned no explicit deprecation statement or version; the ctx7 API entry states 20.2. Use 20.2 with that attribution.
- [V] Legacy and new APIs may coexist in an app but not in the same component; no content projection across the two systems; `animate.leave` needs `animationComplete()` for callback usage, with `MAX_ANIMATION_TIMEOUT`. https://angular.dev/guide/animations
- [V] CSS guide: `animate.enter`/`animate.leave`, child leave animations fire only within the same component template, `grid-template-rows` for auto-height, `Element.getAnimations()`, `prefers-reduced-motion`. https://angular.dev/guide/animations/css
- [U] Cost: animate `transform`/`opacity` (compositor) not layout properties; not in a fetched source for this topic.
- Options: Q respect reduced motion, swap layout-property animations for transform; M migrate a component from `trigger()` to CSS + `animate.enter/leave`; P remove `@angular/animations` app-wide (also drops `provideAnimations`, bundle size claim [U]).
- Migration is per-component and needs visual verification: not safe to automate fully.

## 10. Layout, style recalculation, forced reflow

- [V] Forced sync layout = write style then read layout property; layout thrashing = repeated in a loop; fix by batching reads then writes; DevTools "Forced Reflow" insight; LoAF `forcedStyleAndLayoutDuration`. https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing
- [V] Angular hook phases enforce this: `afterNextRender`/`afterEveryRender` `read` and `write` phases, avoid `earlyRead`/`mixedReadWrite`. https://angular.dev/api/core/afterNextRender
- Common Angular patterns [U reasoning]: reading `offsetHeight`/`getBoundingClientRect()` in `ngAfterViewChecked`, `ngDoCheck`, or per-item in a loop; measuring after each `@for` item.
- Options: Q move measurement into `afterNextRender` read phase, hoist reads out of loops; M `ResizeObserver`/`IntersectionObserver` instead of polling; P CSS `content-visibility` / containment (unverified feature claim [U]).

## 11. Where to read more (URLs)
- INP: https://web.dev/articles/inp
- Optimize long tasks: https://web.dev/articles/optimize-long-tasks
- Angular runtime perf: https://angular.dev/best-practices/runtime-performance
- Zone pollution: https://angular.dev/best-practices/zone-pollution
- Chrome profiling: https://angular.dev/best-practices/profiling-with-chrome-devtools
- DevTools profiler: https://angular.dev/tools/devtools/profiler
- Zoneless: https://angular.dev/guide/zoneless
- Signals: https://angular.dev/guide/signals
- RxJS interop: https://angular.dev/ecosystem/rxjs-interop
- Signal forms: https://angular.dev/guide/forms/signals/overview
- Web workers: https://angular.dev/ecosystem/web-workers
- Animations: https://angular.dev/guide/animations , https://angular.dev/guide/animations/css
- Pipes: https://angular.dev/guide/templates/pipes
- CDK scrolling: https://material.angular.dev/cdk/scrolling/overview
- Heap snapshots: https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots
- Background tasks: https://developer.mozilla.org/en-US/docs/Web/API/Background_Tasks_API
- Layout thrash: https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing

## Proposed skill content: `references/runtime.md`

Global rule for the file: every recommendation carries Size (Q/M/P), Risk, Auto? (safe to automate / propose only / user decision).

1. Triage flow (what symptom -> section): slow click (INP) -> 2, 7, 3; scroll jank -> 4, 10, 9; memory growth -> 8, 5; slow typing in forms -> 3, 5.
2. Profiling
   - Measure: Angular DevTools Profiler, `enableProfiling()` Chrome track (v22 doc, dev only), INP phases, field vs lab.
   - Flame reading table: Angular track colors, CD passes, layout after scripting.
   - Sizes: Q one recording; M RUM; P CI regression.
3. Long tasks and workers
   - Measure: long tasks / LoAF; INP processing phase.
   - Q: yield helper with fallback; M: chunk + runOutsideAngular; P: Web Worker.
   - Pitfalls: Safari lacks `scheduler.yield` (per web.dev), `requestIdleCallback` limits, SSR worker fallback.
4. Forms: valueChanges fan-out, `emitEvent`/`onlySelf`, `updateOn` (verify), signal forms status, zoneless `markForCheck` gotcha.
5. Big lists: `track`, virtual scroll caveats, pagination, grid config (verify AG Grid page).
6. RxJS: cleanup, shareReplay, flattening operator table, combineLatest, toSignal/toObservable costs. Verify [U] items against rxjs.dev first.
7. Signals: effect writes, equality, `untracked`, async tracking boundary, computed granularity.
8. Change detection: zone pollution, zoneless (default v21+), OnPush, ExpressionChanged (verify), pure pipes.
9. Memory: heap snapshot workflow, leak checklist, cleanup via `DestroyRef`.
10. Animations: 20.2 deprecation, coexist rules, CSS guidance, reduced motion.
11. Layout: forced reflow, read/write phases, observers.
12. Automation matrix
    - Safe to automate: grep-based reports (unsubscribed subscribes, listeners, timers, method calls in templates), add `takeUntilDestroyed` in injection context, add `refCount: true` (after confirming semantics), enable `enableProfiling()` in dev.
    - Propose only: `track` id choice, virtual scroll, yielding in loops, `updateOn`, OnPush.
    - User decision: zoneless migration, signal forms migration, animation migration, flattening operator changes, web worker adoption.
13. Links per topic (section 11 above).
