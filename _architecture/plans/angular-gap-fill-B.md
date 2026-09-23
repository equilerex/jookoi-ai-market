# Angular perf advisor: gap-fill research B

Researched 2026-09-21 by curl of raw GitHub files (no summarizer). Tags: [V] read in a fetched source, [U] not confirmed. Angular refs: `main` plus branches `20.x`, `21.0.x`, `22.0.x`, `22.1.x` (22.x release tags do not exist in the repo; only branches, and tags stop at 21.0.3). Base URL A = `https://raw.githubusercontent.com/angular/angular`. RxJS refs: `ReactiveX/rxjs` branch `7.x`. Components repo: `angular/components` `main`.

## 1. Data loading

- HttpClient in-flight dedupe: [U] not confirmed positively. Grep of `packages/common/http/src/client.ts`, `interceptor.ts`, `transfer_cache.ts`, `resource.ts` (main) for `shareReplay|share(|inflight|dedup` returned nothing [V for that grep]. Absence in source, not a documented statement. Advise: do not assume dedupe; measure in Network tab.
- `resource`/`httpResource` cross-instance dedupe or cache: no cache or dedupe code in `packages/core/src/resource/resource.ts` or `packages/common/http/src/resource.ts` (grep for `dedup|inflight` empty; the only "cache" in them is TransferState) [V grep, U as a statement]. Two instances with equal params issue two requests [U].
- `resource({id})`: stores the resolved value in `TransferState` on the server, client initializes resource as `resolved`; `id` must be unique and identical on server and client; do not set on user-specific data [V, A/main/adev/src/content/guide/signals/resource.md].
- `httpResource` is covered by the HTTP transfer cache: `getInitialStream` calls `retrieveStateFromCache(req, cacheOptions, transferState, originMap)` and initializes the signal with the cached body [V, A/main/packages/common/http/src/resource.ts lines ~244-262]. `httpResource` also accepts `transferCache` option per the guide [V, http-resource.md line 38 shows `transferCache: true` in an example].
- Stability: `resource`, `httpResource`, `rxResource` are `@publicApi 22.0` on `22.0.x` and `main` [V, rx_resource.ts and resource/api.ts on 22.0.x]. On `21.0.x` the same files are `@experimental` [V, A/21.0.x/packages/core/rxjs-interop/src/rx_resource.ts, packages/core/src/resource/api.ts]. So: experimental in 19-21, stable in 22.
- `rxResource` semantics [V, A/main/packages/core/rxjs-interop/src/rx_resource.ts]: option is `stream` returning an Observable; each `next` sets the resource value (`send({value})`), so multiple emissions update the value in place; first emission resolves the loading promise; `error` becomes a resource error; completing with no emission throws `NG0991` (`RESOURCE_COMPLETED_BEFORE_PRODUCING_VALUE`), e.g. after `catchError(() => EMPTY)`; on params change/abort the previous subscription is unsubscribed (abort listener calls `sub.unsubscribe()`). Requires injection context or `injector`.
- Default HttpClient backend: fetch is the default from 22.0. `21.0.x`/`21.2.x` provider.ts: `inject(FETCH_BACKEND, {optional: true}) ?? inject(HttpXhrBackend)` (XHR default) [V]. `22.0.x` and `22.1.x` provider.ts: `return inject(FetchBackend)` and `withFetch` is `@deprecated ... is not required anymore. FetchBackend is the default HttpBackend` [V, A/22.0.x/packages/common/http/src/provider.ts lines 124, 298]. `withXhr()` exists; XHR on server is deprecated, removal intended in Angular 23 [V, provider.ts, guide/http/setup.md]. In 20 and 21, `withFetch()` is needed to get fetch [V by absence of default in 21.x code; 20.0.0 line 131 same pattern].
- SSR transfer cache lifetime: client stops using it once the app is stable: "`HttpClient` stops using the cache once an application becomes stable while running in a browser" [V, A/main/adev/src/content/guide/ssr.md line 419]; implementation: `appRef.whenStable().then(() => cacheState.isCacheActive = false)` [V, transfer_cache.ts lines ~486-494]. Default eligible: GET/HEAD without `Authorization`, `Proxy-Authorization`, `Cookie` headers, no credentials; skipped for `Cache-Control` no-store/no-cache/private and `Set-Cookie` responses [V, ssr.md 454].

## 2. RxJS (7.x)

- `shareReplay` source [V, 7.x/src/internal/operators/shareReplay.ts]: implemented as `share({connector: () => new ReplaySubject(bufferSize, windowTime, scheduler), resetOnError: true, resetOnComplete: false, resetOnRefCountZero: refCount})`; `refCount` defaults to `false`. Doc: with `refCount` false the source is not unsubscribed when subscribers drop to zero ("potentially run for ever"); with `true` the source is unsubscribed at zero and a new subscriber creates a new ReplaySubject and re-subscribes to the source; "A successfully completed source will stay cached forever, but an errored source can be retried."
- Pitfall derivation [V from the above]: `refCount:false` on a long-lived/infinite source leaks the subscription; `refCount:true` on an HTTP-style source re-issues the request if all subscribers leave and a new one arrives before/after completion? Completion is not reset (`resetOnComplete:false`), so a completed HTTP call stays cached even with `refCount:true`. Recommended form for HTTP caching: `shareReplay({bufferSize:1, refCount:true})` [derived, not a quoted recommendation].
- Flattening operators, JSDoc [V, 7.x/src/internal/operators/*.ts]: `switchMap` "emitting values only from the most recently projected Observable" (previous inner is unsubscribed); `exhaustMap` projects "only if the previous projected Observable has completed", ignoring new projections meanwhile; `concatMap` "in a serialized fashion waiting for each one to complete", equivalent to `mergeMap` with concurrency 1; `mergeMap` merges all, has `concurrent` param (default Infinity). Use-case mapping (search/typeahead = switchMap, submit = exhaustMap, ordered writes = concatMap, parallel = mergeMap with concurrent cap) is my mapping, [U] as an official statement: the official operator decision tree data was not fetchable (`docs_app/content/operator-decision-tree.md` and JSON returned 404; tree is data-driven by a component in `docs_app/src/app/custom-elements/operator-decision-tree/`).
- `combineLatest` [V, 7.x/src/internal/observable/combineLatest.ts JSDoc]: waits for every input to emit at least once before emitting; earlier values from an input that emitted before others started are lost except the last; emits a new array whenever any input emits; if one input never emits, nothing is emitted; completes when all complete; errors when any errors.
- `debounceTime` [V, debounceTime.ts]: emits only after `dueTime` of silence, drops earlier pending values, on completion emits the last cached value, on error the pending value is not emitted; it delays output. `distinctUntilChanged` [V, distinctUntilChanged.ts]: emits values distinct from the last emitted value (not from all previous), optional comparator/keySelector.
- `takeUntilDestroyed` [V, A/main/packages/core/rxjs-interop/src/take_until_destroyed.ts, `@publicApi 19.0`]: with no argument calls `assertInInjectionContext` (dev mode) then `inject(DestroyRef)`; with a `DestroyRef` argument works outside injection context; implemented as `takeUntil` over an observable that emits on `destroyRef.onDestroy` (emits immediately if already destroyed). Guide: "Always provide a DestroyRef if your code may call takeUntilDestroyed outside of an injection context" [V, ecosystem/rxjs-interop/take-until-destroyed.md].
- `toSignal` [V, to_signal.ts `@publicApi 20.0`, rxjs-interop guide]: subscribes immediately (side effects); auto-unsubscribes when the creating context is destroyed (via `DestroyRef`, or the `injector` option); `manualCleanup: true` keeps the subscription until the Observable completes and needs no injection context; without `initialValue` signal is `undefined` until first emission; `requireSync: true` throws at runtime if the Observable does not emit synchronously (no `undefined` in type); errors from the Observable are rethrown when the signal is read; dev-mode assertion forbids calling in a reactive context (each call creates a new subscription).

## 3. Forms

- `updateOn` [V, A/main/packages/forms/src/model/abstract_model.ts line 254; form_control.ts lines 133-146]: `AbstractControlOptions.updateOn?: 'change' | 'blur' | 'submit'`, default `'change'`; child inherits from parent (`get updateOn` returns own, else parent's, else `'change'`). `new FormControl('', {updateOn: 'blur'})`. Effect on value/validity: model updates once per blur/submit instead of per keystroke. The performance statement (fewer validator runs and `valueChanges` emissions) follows from that mechanism but no doc states a number [U for measured effect].
- `valueChanges` and large `FormArray` [V, abstract_model.ts `updateValueAndValidity` lines ~1397-1426, form_array.ts `_updateValue` line 531]: one control change calls `_updateValue`, runs validators, emits `valueChanges`/`statusChanges` on that control, then (unless `onlySelf`) repeats on the parent up to the root. `FormArray._updateValue` rebuilds the value array by mapping all enabled children, O(n) per ancestor per change. `push`, `insert`, `removeAt` accept `{emitEvent}` and emit by default (`emitEvent: false` suppresses). `FormArray.clear`/`setValue` paths also accept it (not read in detail). Batch-building a big array with `emitEvent:false` then one `updateValueAndValidity` is a derived tactic [U as documented advice].
- Signal Forms status: comparison guide table lists "Status: Stable (v22+)" for Signal Forms [V, A/main/adev/src/content/guide/forms/signals/comparison.md line 16]. Overview requires Angular v21+ and says for existing reactive-forms apps or "production stability guarantees" reactive forms "remain a solid choice" [V, guide/forms/signals/overview.md]; that wording may lag the table. `@publicApi 22.0` on `form()` API [V, packages/forms/signals/src/api/structure.ts]; an `experimentalWebMcpTool` option inside is `@experimental`. No performance claims found in overview or comparison guide (grep for "perform" empty) [V absence]. Do not claim Signal Forms are faster.

## 4. CDK virtual scroll

Sources: `angular/components` main `src/cdk/scrolling/scrolling.md`, `fixed-size-virtual-scroll.ts`, `virtual-for-of.ts`.
- `itemSize` on `cdk-virtual-scroll-viewport` is required for the fixed-size strategy (px) [V, scrolling.md lines 28, 74].
- `minBufferPx` default 100 and `maxBufferPx` default 200 [V, fixed-size-virtual-scroll.ts lines 216, 228]. Semantics: below `minBufferPx` the viewport renders more, back up to at least `maxBufferPx` [V, scrolling.md lines 77-89].
- `cdkVirtualForTemplateCacheSize` (attribute `templateCacheSize` in docs prose): default 20 views, `0` disables the view cache; reduce if templates are memory-heavy [V, virtual-for-of.ts line 143-146, scrolling.md 52-57].
- `cdkVirtualForTrackBy` exists; index passed is the data-source index, not the rendered index [V, virtual-for-of.ts 118-131, scrolling.md 48-50].
- Autosize: lives in `@angular/cdk-experimental` (`AutoSizeVirtualScrollStrategy`), doc says "not ready for production use yet" [V, scrolling.md 93-95; auto.ts in `src/cdk-experimental/scrolling`]. `scrollToIndex` unsupported for it (source error text, auto.ts line 172) [V].
- Other limits [V, scrolling.md]: `<tr>`/`<li>` need a proper parent wrapped by the viewport, and that parent must not add margin/padding; horizontal mode needs CSS (`orientation="horizontal"`); custom strategy via `VIRTUAL_SCROLL_STRATEGY`; "append only mode" section exists (`appendOnly`, items persist after scrolling out of view; `virtual-scroll-viewport.ts` line 120) so DOM grows.

## 5. NG0100 and content-visibility

- NG0100 [V, A/main/adev/src/content/reference/errors/NG0100.md]: thrown in dev mode only; Angular runs an extra check after each change detection run; occurs when a binding value changes after being checked, e.g. a method/getter returning a different value per call, a child changing its parent's values, lifecycle hooks (`ngAfterViewInit`, `ngOnChanges`), async loading state. Fix guidance: no binding changes after CD; use the right hook; for `ngAfterViewInit` set initial values in constructor or `ngOnInit`, or use `ngAfterContentInit`; methods bound in the template must not update other bindings. Angular states the error prevents "erratic UI behavior or a possible infinite loop". Signals/`ChangeDetectorRef.detectChanges` alternatives are not on this page [U].
- `content-visibility: auto` [V, https://web.dev/articles/content-visibility]: applies containment (size, layout, style, paint) and skips rendering of off-screen subtrees; demo shows "7x rendering performance boost" on initial load (30 ms vs 232 ms range as in article; only the 7x figure read); off-screen content stays in the DOM and accessibility tree, so find-in-page and navigation still work; landmark elements with `display:none`/`visibility:hidden` styles still appear in the accessibility tree when off-screen; the element lays out as empty (0 height, scrollbar jumps) without `contain-intrinsic-size` (e.g. `auto 300px`; `auto` keyword remembers the last rendered size); calling DOM APIs that force rendering on skipped subtrees defeats the skip. Page shows browser support with Firefox 125 and Safari 18 as first versions [V, alt text in page].

## 6. Heap snapshot leak procedure

Sources: https://developer.chrome.com/docs/devtools/memory-problems and `/heap-snapshots` [V, fetched raw HTML].
- The "three snapshot" claim is NOT in either page (grep for "three" and "third snapshot" empty) [V absence]. The documented Comparison procedure uses two snapshots: take snapshot 1 before the operation; perform the operation; perform the reverse operation and repeat it a few times; take snapshot 2, switch its view to Comparison against Snapshot 1. Comparison shows deltas (added/deleted objects). Filters include "Objects allocated between Snapshots 1 and Snapshots 2" and "Objects allocated before snapshot 1"; a new snapshot adds another between-filter. "Taking a snapshot always starts with garbage collection." Snapshots only include objects reachable from the global object. Detached DOM trees are found via the Heap Snapshot with the "Detached" filter [V, memory-problems detached DOM section]. The three-snapshot technique (snapshot after a warmup, then after action, then after repeat) is community lore, [U].

## Proposed skill content (verified facts only)

Data loading
- Fetch is the default HttpClient backend from Angular 22; in 20 and 21 add `withFetch()`. `withFetch` is deprecated in 22. `withXhr()` on the server is deprecated, removal planned in 23.
- `resource`, `httpResource`, `rxResource` are stable in 22 and experimental in 21 and earlier.
- `rxResource` takes `stream`; each emission updates the value; completing with no emission throws NG0991; a new params value unsubscribes the previous stream.
- Do not rely on HttpClient or resource to dedupe identical concurrent requests; no such code exists in the sources read. Verify per app.
- SSR transfer cache: on the client it is used only until the app is first stable; `httpResource` reads it; `resource({id})` uses TransferState when `id` is set and identical on both sides; do not use `id` on user-specific data.
- Transfer cache default skips requests with auth/cookie headers, credentials, and no-store/no-cache/private responses.

RxJS
- `shareReplay` defaults `refCount:false` (source never unsubscribed); use `shareReplay({bufferSize:1, refCount:true})` for streams that must stop when unobserved. Completed sources stay cached; errored sources retry on next subscribe.
- `switchMap` cancels the previous inner; `exhaustMap` ignores new sources while one runs; `concatMap` queues (concurrency 1); `mergeMap` runs all with optional `concurrent` cap.
- `combineLatest` emits nothing until every source emitted once, then on every source emission.
- `debounceTime` drops pending values on new emissions and emits last on completion; `distinctUntilChanged` compares to the last emitted value only.
- `takeUntilDestroyed()` needs an injection context or an explicit `DestroyRef`.
- `toSignal` unsubscribes on destroy; `manualCleanup` opts out; `requireSync` throws if no synchronous emission; without `initialValue` the value is `undefined`; do not call it in a reactive context.

Forms
- `updateOn: 'blur' | 'submit'` is set per control or inherited from the parent group/array; default `'change'`.
- Each control change recomputes values and emits `valueChanges` up every ancestor, and `FormArray` rebuilds its value from all children, so large arrays cost O(n) per keystroke per ancestor. Use `emitEvent:false` on `push`/`insert`/`removeAt` for bulk edits.
- Signal Forms are listed Stable in v22 in the comparison guide; the overview still recommends reactive forms for existing apps and stability guarantees; no performance claim is documented.

CDK virtual scroll
- Set `itemSize`; `minBufferPx` default 100, `maxBufferPx` default 200; template cache default 20 (`0` disables); provide `cdkVirtualForTrackBy` (index is the data index).
- The autosize strategy is in `cdk-experimental` and documented as not production ready; `scrollToIndex` is unsupported there.
- Parent element for `tr`/`li` must add no margin/padding.

Rendering
- NG0100 is dev-mode only; fix by not changing bindings after check: set initial values in constructor/`ngOnInit`, avoid getters/methods with varying results, avoid children mutating parent bindings.
- `content-visibility: auto` skips off-screen rendering; pair with `contain-intrinsic-size` (use `auto <size>`), keep DOM APIs that force layout out of skipped subtrees; content stays searchable and in the accessibility tree.

Memory
- Chrome docs procedure: snapshot, do action, reverse action a few times, second snapshot in Comparison view; snapshots start with GC; look at Detached DOM nodes. Docs describe two snapshots, not three.

## Still unverified

- Official RxJS operator decision-tree text (JSDoc used instead).
- Any positive documentation that HttpClient/resource do not dedupe.
- Measured performance effect of `updateOn` and of Signal Forms.
- `content-visibility` numbers beyond the 7x claim; current browser support table values beyond Firefox 125/Safari 18 alt text.
- Three-snapshot technique.
