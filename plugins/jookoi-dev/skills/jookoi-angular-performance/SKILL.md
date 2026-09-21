---
name: jookoi-angular-performance
description: Audit and fix performance in an existing Angular app - bundle size and budgets, lazy routes, @defer, NgOptimizedImage, change detection (OnPush, signals, zoneless), SSR and hydration, and Core Web Vitals (LCP, INP, CLS). Use this whenever the user says an Angular app is slow, janky, heavy, or failing a budget or Lighthouse score, asks to "optimize", "speed up", "audit performance", "shrink the bundle", "fix LCP/INP/CLS", "go zoneless", or wants to review Angular code for performance problems. Performance only - for generating new Angular features or general Angular best practices use angular-developer, for scaffolding use angular-new-app.
---

# jookoi-angular-performance

Find what actually makes an Angular app slow, fix the cheap high-impact things first, and prove the result with numbers.

Baseline: **Angular 22**. OnPush is the default for new components, new apps are zoneless, signals and `resource`/`httpResource` are the standard reactive path. Older projects get the same audit, but check `references/version-notes.md` before recommending any API, because names and defaults moved between v17 and v22.

## Workflow

1. **Version.** Read `@angular/core` from `node_modules/@angular/core/package.json` (or `package.json`). Everything below depends on it.
2. **Static audit.** Run `node <this-skill>/scripts/audit.mjs <workspace-root>`. It reports budget config, builder, zone vs zoneless, legacy control flow, bad `track`, template calls, images, lazy routes, heavy imports, SSR wiring, and whether this skill is stale for the project's version. Treat every hit as a lead to check, not a verdict.
3. **Measure before touching code.** Ask before running builds or Lighthouse if they are slow in this repo, or hand the commands to the user:
   - `ng build --configuration production` for budget warnings and per-chunk sizes.
   - `ng build --configuration production --stats-json`, then open `dist/<app>/stats.json` in esbuild.github.io/analyze to see what fills the initial chunk.
   - Lighthouse (mobile) on the 1-3 routes that matter, noting LCP, INP/TBT, CLS.
4. **Pick by symptom**, using the table below. Don't do change-detection work to fix an LCP problem.
5. **Fix in rank order**, one change at a time, and re-measure the same route with the same tool. Report before/after numbers, not adjectives.

| Symptom | Look at first | Reference |
|---|---|---|
| Initial bundle over budget, slow FCP | Lazy routes, `@defer`, whole-library imports, eager feature imports via barrels | `loading.md` |
| LCP > 2.5s | LCP image `priority`, SSR/prerender for content routes, fonts, render-blocking 3P scripts | `loading.md` |
| CLS > 0.1 | Image dimensions, `@defer` above the fold, placeholder sizing, hydration | `loading.md` |
| INP > 200ms, janky scrolling or typing | Template calls, `track`, OnPush/signals, long tasks, huge lists | `change-detection.md` |
| Memory grows over navigation | Subscriptions without teardown, detached DOM | `measuring.md` |

## Ranked fixes

Cheap and high-impact first. #1-#3 apply to nearly every app.

1. **Lazy routes + real budgets.** `loadComponent`/`loadChildren` for everything except the landing route. An `initial` budget set just above the current size, with `maximumError`, so regressions fail the build.
2. **`@defer` heavy, below-the-fold components.** Charts, maps, editors, comment threads. Pair with `prefetch on idle` when the user will likely need it.
3. **`NgOptimizedImage`**, with `priority` on the LCP image only.
4. **OnPush + signals** (default in v22, manual before). State in `signal`/`computed`, async reads via `httpResource`/`resource` or `toSignal()`.
5. **SSR + hydration** for content, marketing, and e-commerce routes. Rarely worth it behind a login.
6. **Zoneless**, after #4 is done and third-party libs are checked.
7. **Preloading** for lazy routes: gated custom strategy or ngx-quicklink in big apps, `PreloadAllModules` in small ones.
8. **Remove per-cycle template work**: function calls with arguments, heavy getters, missing or identity `track`.
9. **Service worker** (`ng add @angular/pwa`) for repeat-visit speed, when the app is revisited often.

## Pitfalls that the audit can't fully see

- **Signal reads look like function calls.** `{{ count() }}` is correct and cheap. Only calls that compute (`{{ format(item, 2) }}`, getters doing work) are the problem. Don't "fix" signal reads.
- **Barrels only hurt at the eager/lazy boundary.** esbuild tree-shakes side-effect-free barrels fine. The problem is eager code importing a lazy feature's `index.ts`, which drags the feature into main. Verify in `stats.json`, don't mass-rewrite imports.
- **Zoneless breaks silent state mutation.** A chart or map lib that mutates component fields in its own callback no longer triggers a render. Write those values into signals, or call `markForCheck()`.
- **`@defer` above the fold without SSR `hydrate` triggers** renders the placeholder, then swaps: CLS. Nested `@defer` blocks with the same trigger fire at once.
- **Lighthouse is lab data** with run-to-run noise. A one-point score change means nothing. Compare metrics over 3+ runs, confirm with field data (`web-vitals`) when it exists.

## Composing with other skills

`angular-developer` (official Angular team skill) owns how to write Angular code in general. This skill owns finding and fixing performance problems. When a fix means writing a new component, service, or signal form, follow `angular-developer` conventions for the code itself.

## References

- `references/change-detection.md`: OnPush, signals, zoneless migration order, zone pollution, template cost, long lists.
- `references/loading.md`: lazy routes, `@defer` and triggers, preloading, images, fonts, SSR/SSG/hydration, CWV mapping.
- `references/measuring.md`: Angular DevTools, Chrome performance panel, bundle analysis, budgets, Lighthouse CI, lint rules, RUM.
- `references/version-notes.md`: what changed per major (v16-v22) and which APIs to double-check on older projects.
- `README.md`: provenance, verified baseline, and the refresh checklist for when a new major ships.
