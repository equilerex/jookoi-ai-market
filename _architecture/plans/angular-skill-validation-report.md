# Validation report: jookoi-angular-performance on JooKoi-frontpage-to-the-open-web

The actionable, prioritised version of this report is `angular-skill-improvement-brief.md` (same folder). Start there. Correction to this report's honesty: the session did not read `loading.md`, `ssr.md` or `measurement-automation.md` in full before advising, only greps of them afterwards. Where the skill already covered something (incremental hydration on v22), a gap listed below may be an agent-behaviour gap, not a content gap. The brief separates the two.

Date: 2026-09-21. Angular 22.1.6, zoneless, prerendered static output, PrimeNG 22. Skill read from the working copy. This report is longer than the handoff's 80-line cap because the user asked for extended feedback.

## Findings

| Check | Expected | Actual | Result |
|---|---|---|---|
| No OnPush / zoneless / `standalone: true` / control-flow advice on v22 | none | none proposed. The 51 dead `ChangeDetectionStrategy` imports were reported as leftovers | pass |
| No edits before the user picks | none | audit was read-only, edits started only after the user's picks | pass |
| No builds, installs, CI without asking | ask first | asked for the build and the Lighthouse dependency. Later the user said "your show", so edits followed | pass |
| Leftovers reported with `file:line`, unchanged | yes | reported with line refs, removed only on request | pass |
| Advice matches real config | budgets, hashing, hydration read from `angular.json` | read `angular.json` and `app.config.ts` before advising | pass |
| `PreloadAllModules` / `NoPreloading` | keep `NoPreloading` | kept | pass |
| Measurement setup asks questions first | yes | asked (dependency, build, baseline design) | pass |
| Audit `track` finding correct | correct or low-confidence | `high` finding was a false positive: `track chip` and `track color` track strings, which is correct | **fail** |
| Budget guidance | concrete sizes and rationale | none. See below | **fail** |

## What the skill did not give me, and should have

1. **No reference sizes for budgets.** The repo's `initial` budget was 320/500 kB raw, set in the empty-foundation phase, and the real app was 1.31 MB, so the first build failed. The skill says "set a budget just above the current size" and "budget thresholds are a product call", but gives no way to judge whether a number is reasonable. Add a short table to `chunk-size.md`: the CLI default (500 kB warning / 1 MB error, raw), the widely cited "about 170 kB compressed initial JS" guideline (mark it as unverified and date it), and the rule of thumb that raw size drives parse cost while transfer drives download. State plainly that Angular budgets are raw bytes, so a raw budget and a transfer target are different numbers. Tell the agent to derive a first budget from a measured build: current initial total plus about 15% for warning, plus about 40% for error.
2. **No guidance on judging lazy chunks separately from initial.** The user asked the right question: the whole bundle is not downloaded at once. The skill should say to compute per-route cost (route chunk plus its static imports not already in initial) from `stats.json`, and give the script. I wrote one by hand three times. Ship it in `scripts/`.
3. **Nothing on dependency weight found through the metafile.** The biggest single win here (PrimeNG `table` pulling datepicker, inputnumber, paginator, scroller and select, about 400 kB raw, to render a read-only table) came from grouping `main`'s bytes by package and by file. `chunk-size.md` (steps 3 to 4 of its stats procedure) does say to group a chunk's inputs by package, but ships no script or snippet, so the agent rewrites it each time. Add one. Also add "a wrapper component around a heavy UI kit component that only needs basic features" as a named pattern, with the plain-markup option and the `@defer (hydrate on ...)` option compared.
4. **Eager route components are the first thing to check.** The skill says "lazy routes for everything except the landing route". Here the landing route was the problem: an eager `HomePage` carried the table and a 122 kB data fixture. The audit counted "12 lazy routes" and did not flag that the eager home route imports heavy modules. Add an audit lead: eager `component:` routes whose imports exceed N kB in the metafile.
5. **Shell components importing data-sized modules.** `app-shell-layout` imported a 119 kB fixture for `ALL_SOURCES.length`. An audit lead for large source files (by bytes in `main`) would have found it.
6. **Dependencies and tooling.** The skill says never install unprompted, which held. It gives no view on which tool is the standard for baselines. I proposed Lighthouse as a devDependency from general knowledge. `measurement-automation.md` should name a default (repo-local pinned `lighthouse`, median of 3 runs, committed per-commit JSON) and the questions to ask, and note that `npx --yes lighthouse` is not reproducible. It should also list the Windows failure below.
7. **CI and the build should include measurement.** The user expected Lighthouse and stats to be in `package.json` scripts and CI. The skill treats CI as "ask first" and gives no workflow template. Add one: build with `--stats-json`, serve the static output with brotli and `index.html` per route, run the lab, treat absolute Lighthouse limits as targets and only baseline regressions as failures, keep the CI job non-blocking until a baseline is recorded on a CI runner.

## Facts to fix or add in the references

- **`stats.json` location and naming:** with `--stats-json` on the application builder the file is `<outputPath>/stats.json` (`dist/<project>/stats.json`), not `browser-stats.json`. Lazy `import()` chunks do appear as outputs with `entryPoint` (187 of 360 outputs here). Whether a `bundle` budget matches them by name is still untested. Also untested: whether `anyScript` fires. Both were added to `angular.json`, and neither fired on a passing build, so nothing was proven.
- **A failed build writes no output and no stats.** A budget error or a prerender error aborts before `stats.json` is written. To inspect a failing build the skill should suggest a temporary configuration without budgets, not CLI flag combinations. I tried `--prerender=false`, `--output-mode server` and `--no-server`; all fail or are ignored with `outputMode: static`.
- **Prerender and parameterised routes:** a redirect route such as `learn/:topic` breaks a prerendered build when a `**` prerender server route exists. Fix: `RenderMode.Client` for that path. Worth a line in `ssr.md`.
- **Budget default conflict:** the reference notes that angular.dev (2/4 kB) and the generated template (4/8 kB) disagree on `anyComponentStyle`. Here the 2 kB value flagged two real components at 2.4 and 2.8 kB. Recommend 4/8 unless the project has a reason.
- **Lighthouse on Windows:** `chrome-launcher` often fails to delete its temp profile (`EPERM`) after writing the report and exits non-zero. Treat the report file as the success signal. Add to `measurement-automation.md`.
- **Lab conditions matter more than the setup.** A static preview server without compression and without `route/index.html` handling served the CSR fallback for every deep route and 3 to 4 times the transfer. Every number was about 2x too slow until the server was fixed. `measurement-automation.md` should list this as the first check: confirm the preview serves prerendered HTML and compression before recording a baseline.
- **Package manager mismatch:** not a skill fact, but the skill's setup advice should say "check which package manager installed `node_modules` before running an install". An interrupted `pnpm add` in an npm-installed tree moved packages into `node_modules/.ignored` and broke the toolchain until they were restored.

## Audit script changes

- `audit.mjs` flags `track x` on any identifier as `high`. Downgrade to `info`, and skip when the iterated item is a string or number (look at the `@for (x of y` source: if `y` is a `string[]` or a literal array of strings, do not flag).
- Add the leads from items 4 and 5 above.
- Keep the other findings at `info` on v22. That part worked.

## Too generic or costly

- The symptom table and ranked quick-fix list were useful for orientation and I did not read most reference files in full. Loading only `chunk-size.md` and `build-and-deploy.md` was enough. Consider stating at the top which reference to load first for each starting symptom, so agents do not load all of them.
- The "Unverified" lists are honest but long. Two of them (lazy-chunk metafile entries, budget defaults) I could have answered with one build. Where a single command settles the question, put the command in the list.

## Open questions

- Do `bundle` and `anyScript` budgets fire on lazy chunks in Angular 22? The largest lazy chunk (669 kB, mermaid) is under the 700 kB `anyScript` warning, so it was not exercised.
- Should the audit include a `--deep` mode that reads `stats.json` when present?
