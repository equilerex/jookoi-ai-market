---
name: jookoi-angular-performance
description: Audit and fix Angular performance. Bundles, lazy routes, SSR, hydration, change detection, assets, measurement. Advise and implement.
metadata:
  last_updated: "2026-09-23T00:00:00Z"
  author: Joosep Kõivistik
  repository: https://github.com/equilerex/jookoi-ai-market
---

# jookoi-angular-performance

Two jobs. First, an advisor: know how Angular performance works at every size, from a one-line fix to a multi-week project, explain options with cost and risk, and point to the right docs. Second, an operator: run the audit, apply the safe mechanical fixes when asked, and help set up measurement that lets the user compare before and after.

Many findings cannot or should not be fixed on the spot. An audit that lists 40 problems is a planning input, not a to-do list to execute.

Baseline: **Angular 22**. OnPush is the default for new components, new apps are zoneless, signals and `resource`/`httpResource` are the standard reactive path. Older projects get the same treatment, but check `references/version-notes.md` before recommending any API, because names and defaults moved between v17 and v22.

## Working rules

- **Before naming any API, flag or default, open the reference for that topic and quote its version line.** Do not answer from memory, even when sure. A real run told a user that deferring a table needed `withIncrementalHydration()` on v22 without opening `ssr.md`, which says the opposite.
- **v22 traps, seen even when no reference is opened:** `withIncrementalHydration()` is deprecated and default-on (never suggest it on 22, required on 20 and 21). Zoneless is `provideZonelessChangeDetection()` (the `Experimental` name is stale). OnPush is the default, so a missing `OnPush` is never a finding and only explicit `Default`/`Eager` opt-outs get reported. The stats file was `dist/<project>/stats.json` on 22.1.6, not `browser-stats.json`, see `references/build-and-deploy.md`.
- **Detect actual state, not just the version.** A project on a new major may not have migrated: it can still ship zone.js, `ChangeDetectionStrategy.Default`/`Eager` opt-outs, `*ngFor`, or old provider names. Version tells you the framework default, the code and config tell you what the app does.
- Never recommend what the project demonstrably already has (OnPush by default on v22+, zoneless with no zone.js polyfill on v21+, `@for` already in use, standalone by default on v19+).
- Legacy leftovers on a newer major: **report, do not change.** List each with `file:line`, what it is, and its cost or gain. Some are deliberate.
- **Audit and analysis are read-only.** Edit code only for items the user picks. A blanket "fix everything" is not a pick for behavior-changing migrations (OnPush opt-outs, zoneless, SSR, preloading): confirm those individually.
- Schematics (`ng update`, `ng generate @angular/core:control-flow`) are proposed as commands, not run unprompted.
- **Never install tools, add CI jobs, or schedule runs unprompted.** Setting up measurement is a conversation: ask what fits the project first (`references/measurement-automation.md` lists the questions).
- **Once an install is approved, check the package manager first.** `node_modules/.package-lock.json` means npm, `node_modules/.pnpm` means pnpm. Stop dev servers, run the install once with the matching manager, write the full output to a file, and never retry with another manager or output filter. A retried `pnpm add` in an npm-installed tree removed `@angular/build` and `@angular/cli`.
- **Write scripts and JSON with a file-writing tool, not shell heredocs.** Some harnesses mangle backslashes in heredocs (`\\n`, `\\b`), which breaks regexes.
- Say what is unverified. The references end with an "Unverified, check before relying" list. Do not turn those items into confident advice, and check the project's own version and generated config before quoting a default.

## What the user is asking for

| Situation | Do this |
|---|---|
| "It's slow / audit it / fix it" | Quick audit and fix workflow below |
| "How should we approach X / what are the options / what does Y cost" | Advise: options at three sizes (quick, moderate, project), tradeoffs, docs. Pick the topic reference from the table. Offer to write a plan into the repo if the work is big |
| "Audit found lots, we can't do it all" | Group findings by size and risk, propose an order, write it down as a plan (use the `jookoi-paper-trail` conventions if the repo has them) |
| "Set up Lighthouse / monitoring / compare versions" | `references/measurement-automation.md`: ask the questions first, propose a setup, record a baseline together |
| "What should I read" | `references/docs-map.md` |

## Quick audit and fix workflow

1. **Version.** Read `@angular/core` from `node_modules/@angular/core/package.json` (or `package.json`). Everything depends on it.
2. **Static audit.** Run `node <this-skill>/scripts/audit.mjs <workspace-root>`. It reports budget config, builder, zone vs zoneless, legacy control flow, bad `track`, template calls, images, lazy routes, preloading, heavy imports, SSR wiring, and skill staleness. Every hit is a lead, not a verdict.
3. **Measure before touching code.** Ask before running builds or Lighthouse if they are slow in this repo, or hand the commands to the user:
   - `ng build --configuration production` for budget warnings and per-chunk sizes.
   - Add `statsJson` to the build (see `references/build-and-deploy.md` for the option and where the metafile lands) and open it in esbuild.github.io/analyze. A failing build writes no stats file.
   - With a stats file, run `node <this-skill>/scripts/route-cost.mjs <dist/project>` (what each lazy route costs on top of initial) and `scripts/chunk-packages.mjs <dist/project> <chunk|entry|initial>` (which package fills a chunk). Both are read-only.
   - Lighthouse (mobile) on the 1-3 routes that matter: LCP, INP/TBT, CLS. One run is noise, see `measuring.md`.
4. **Pick by symptom**, using the table below. Do not do change-detection work to fix an LCP problem.
5. **Fix in rank order**, one change at a time, and re-measure the same route with the same tool. Report before and after numbers, not adjectives.

| Symptom | Look at first | Reference |
|---|---|---|
| Initial bundle over budget, slow FCP | Lazy routes, `@defer`, whole-library imports, eager imports of lazy features | `chunk-size.md`, `loading.md` |
| Click on a link waits before anything happens | Lazy chunk size, preloading on intent, a navigation progress indicator | `chunk-size.md`, `preloading.md` |
| LCP > 2.5s | LCP image `priority`, SSR/prerender for content routes, fonts, render-blocking scripts, TTFB | `assets-and-third-parties.md`, `ssr.md`, `loading.md` |
| CLS > 0.1 | Image dimensions, `@defer` above the fold, placeholder sizing, late fonts | `assets-and-third-parties.md`, `loading.md` |
| INP > 200ms, janky scroll or typing | Template calls, `track`, OnPush/signals, long tasks, long lists, third-party scripts | `change-detection.md`, `runtime.md` |
| Slow data, spinners, request waterfalls | Resolvers, nested fetches, resource usage, caching | `data-loading.md` |
| Memory grows over navigation | Subscriptions without teardown, detached DOM, heap snapshots | `runtime.md` |
| Fine in dev, slow in prod or after deploy | Build config, compression, cache headers, service worker | `build-and-deploy.md` |
| No way to tell if it got better or worse | Baselines, CI gates, RUM | `measurement-automation.md`, `measuring.md` |

## Ranked quick fixes

Cheap and high-impact first. #1-#4 apply to nearly every app. Each is a starting point, the topic reference has the options and pitfalls.

1. **Lazy routes + real budgets.** `loadComponent`/`loadChildren` for everything except the landing route. Budgets derived from a real build, not guessed (`references/chunk-size.md`, "Budget sizing"), with `maximumError`, so regressions fail the build.
2. **Check what the landing route and the shell import.** Both are eager by definition, so whatever they import lands in the initial bundle. Two of the three causes in a real run were here: a landing route carrying a whole table stack, and a shell importing a 119 kB data module for one `.length`. Price it with `scripts/route-cost.mjs`, see `chunk-size.md`.
3. **`@defer` heavy, below-the-fold components.** Charts, maps, editors, comment threads. Also check wrappers that use one or two features of a heavy UI-kit component (`chunk-size.md`).
4. **`NgOptimizedImage`**, with `priority` on the LCP image only.
5. **OnPush + signals** (below v22 add it. On v22+ only report explicit opt-outs, never bulk-remove them).
6. **SSR + hydration** for content, marketing, and e-commerce routes. Rarely worth it behind a login. See `ssr.md` for when it does not pay off.
7. **Zoneless**, only if the app still ships zone.js. Skip when it is already zoneless. If a v21+ app still ships zone.js, report it and let the user decide.
8. **Preloading**: keep `NoPreloading` (the default) unless measurement shows chunk waits on likely-next routes. Then use a selective strategy, not `PreloadAllModules`, which ignores `canMatch` and network state. See `preloading.md`.
9. **Remove per-cycle template work**: function calls with arguments, heavy getters, missing or identity `track`.
10. **Service worker** for repeat-visit speed, when the app is revisited often. Read the update risks in `build-and-deploy.md` first.

## Pitfalls the audit can't fully see

- **Signal reads look like function calls.** `{{ count() }}` is correct and cheap. Only calls that compute (`{{ format(item, 2) }}`, getters doing work) are the problem. Don't "fix" signal reads.
- **Barrels only hurt at the eager/lazy boundary.** esbuild tree-shakes side-effect-free barrels fine. The problem is eager code importing a lazy feature's `index.ts`, which drags the feature into main. Verify in the stats metafile, don't mass-rewrite imports.
- **Zoneless breaks silent state mutation.** A chart or map lib that mutates component fields in its own callback no longer triggers a render. Write those values into signals, or call `markForCheck()`.
- **`@defer` above the fold without SSR `hydrate` triggers** renders the placeholder, then swaps: CLS. Nested `@defer` blocks with the same trigger fire at once.
- **Lighthouse is lab data** with run-to-run noise. A one-point score change means nothing. Compare metrics over several runs and confirm with field data (`web-vitals`) when it exists.
- **Defaults differ by major and by how the project was created.** Check the project's own `angular.json` and app config before quoting a budget, hashing, or hydration default.

## Composing with other skills

`angular-developer` (official Angular team skill) owns how to write Angular code in general and has only generic performance text. This skill owns finding, planning, and fixing performance problems. When a fix means writing a new component, service, or signal form, follow `angular-developer` conventions for the code itself. Plans and decisions worth keeping go through `jookoi-paper-trail`.

## References

Topic references, each with options at quick, moderate, and project size, how to measure, pitfalls, links, and an unverified list:

- `references/chunk-size.md`: shrinking bundles and lazy chunks, route cost, budget sizing, eager imports, heavy UI-kit wrappers.
- `references/loading.md`: lazy routes, `@defer` and triggers, images, fonts, SSR overview, CWV mapping.
- `references/preloading.md`: default behavior, when not to preload, strategies, DIY vs ngx-quicklink, measurement.
- `references/assets-and-third-parties.md`: images, fonts, CSS, third-party scripts, resource hints, CLS.
- `references/change-detection.md`: OnPush, signals, zoneless migration order, zone pollution, template cost.
- `references/runtime.md`: profiling, INP and long tasks, RxJS, forms, long lists, memory, animations.
- `references/data-loading.md`: waterfalls, resolvers, resource/httpResource, fetch, transfer cache.
- `references/ssr.md`: SSR, prerender, hydration, incremental hydration, when not to use it.
- `references/build-and-deploy.md`: builder options, defaults, modulepreload, compression and caching, service worker, CI gates.
- `references/measuring.md`: manual measuring with DevTools, Lighthouse, bundle analysis, RUM.
- `references/measurement-automation.md`: default setup and traps, baselines, comparison, scheduling, questions to ask the user.
- `scripts/audit.mjs`, `scripts/route-cost.mjs`, `scripts/chunk-packages.mjs`: read-only. Audit is static, the other two read a `stats.json`.
- `references/docs-map.md`: canonical docs by topic and dead URLs to avoid.
- `references/version-notes.md`: what changed per major (v15-v22) and which APIs to double-check.
- `README.md`: provenance, verified baseline, and the refresh checklist for when a new major ships.
