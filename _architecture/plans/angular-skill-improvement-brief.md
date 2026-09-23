# Improvement brief for `jookoi-angular-performance`

Source: a real run of the reworked skill on `D:\repos\Serenity\JooKoi-frontpage-to-the-open-web` (Angular 22.1.6, zoneless, prerendered static, PrimeNG 22), 2026-09-21. The session went from audit to a completed performance pass. Everything below is evidence from that run. Companion file with the pass/fail table: `angular-skill-validation-report.md`.

## Outcome of the run, for calibration

- Initial bundle 1.31 MB raw (254 kB transferred) to 536 kB raw (130 kB). Route cost of home 649 kB to 25 kB lazy.
- Three causes, none of which the audit or the references pointed at: an eager landing route, a wrapper component around a heavy UI-kit table, and a shell component importing a 119 kB data module for one `.length`.
- Old budget (320/500 kB raw) was set in an empty-app phase and was never derived from a build. The first real build failed it.
- Lab numbers were 2x too slow until the preview server was fixed (no compression, and deep routes served the client-rendered fallback instead of the prerendered HTML).

## Behaviour failures of the agent using the skill (not content gaps)

1. **The agent advised from memory instead of the references.** It told the user that deferring the table needed `withIncrementalHydration()`. `ssr.md` says the opposite on v22: incremental hydration is default and `withIncrementalHydration()` is deprecated ("Never suggest `withIncrementalHydration()` on 22"). The agent never loaded `ssr.md` or `loading.md`. The skill's "pick the topic reference from the table" step is easy to skip when the agent believes it knows the answer. Proposed fix: put a one-line rule in `SKILL.md` above the symptom table: "Before naming any API, flag or default, open the reference for that topic and quote its version line. Do not answer from memory." Consider moving the v22 API traps (`withIncrementalHydration`, zoneless provider, OnPush default) into a short block at the top of `SKILL.md`, so they are seen even when no reference is opened.
2. **Package-manager blast radius.** The agent ran `pnpm add` in a tree installed by npm with the dev server running. It failed with `EPERM`, and the agent retried three times, each time moving more packages to `node_modules/.ignored` until `@angular/build` and `@angular/cli` disappeared. The skill said "never install tools unprompted" (which held), but nothing warns about how to install safely once the user approves. Add to `measurement-automation.md` (and wherever a dependency is proposed): check which package manager produced `node_modules` (`node_modules/.package-lock.json` means npm, `node_modules/.pnpm` means pnpm), stop dev servers first, run the install once, capture the full output to a file, and never retry with a different output filter.
3. **A first-draft shell heredoc corrupts backslashes** in this harness (`\\n` and `\\b` arrive as `\n` and a backspace character). Not a skill matter, but any script the skill asks an agent to write (`audit.mjs` snippets, budget JSON) should be written with a file-writing tool. Say so in the skill's "scripts" notes.

## Content gaps, ranked by how much they would have saved

### 1. Budget sizing guidance (the user's main complaint)

The skill says thresholds are "a product call" and "set just above current size". It gives the agent nothing to judge whether a number is sensible. Add a section to `chunk-size.md` (and a pointer from `build-and-deploy.md`):

- **Raw versus transferred.** Angular budgets compare raw bytes. The build table's transfer column is a Brotli estimate. Here 536 kB raw was 130 kB transferred. A raw budget of 500 kB is not a "500 kB download".
- **Reference numbers**, each with a source and a date, marked unverified until checked: the CLI's generated default for a strict app (`initial` 500 kB warning / 1 MB error, raw, per `build-and-deploy.md`); the widely quoted "about 170 kB compressed initial JavaScript" guideline for mobile (verify the source and year before quoting, per the skill's own 2025+ preference); Lighthouse's own transfer-size audits.
- **A derivation rule for a first budget:** measured initial raw total x 1.15 for the warning, x 1.4 for the error, then ratchet down after each win. The run used 536 kB to 600/750 kB.
- **`anyScript` as the lazy-chunk cap**, and what to do about an intentionally big lazy chunk (here a 669 kB mermaid chunk that loads only on documents with a diagram): set the cap just above it and document the exception rather than raising the cap for everything.
- **`anyComponentStyle`:** the run's project had 2/4 kB (angular.dev's number) and two real components at 2.4 and 2.8 kB warned constantly. Recommend 4/8 kB (the generated template) unless there is a reason. `build-and-deploy.md` lines 17 to 18 mention the conflict but pick no side.
- **Ask, then propose:** the skill's "ask before setting a budget" rule is right, but the agent needs a concrete proposal to put in front of the user ("warn 600 kB, error 750 kB because the build is 536 kB") rather than "what number do you want".

### 2. Judge lazy chunks per route, not only the initial bundle

The user asked: "we are not downloading it all in one go, right?" The skill covers `initial` and `anyScript` but not the cost a user actually pays for a route. Add to `chunk-size.md` and ship in `scripts/`: a script that reads `stats.json` and prints, for each route entry chunk, its own size plus the static-import closure that is not already in the initial set. Result for this repo: home 25 kB, search 255 kB, library 212 kB, on top of 536 kB initial. This is the number to put in a budget discussion. The agent wrote this snippet three times by hand.

### 3. Eager route components and shell imports are the first thing to check

Both major wins were an eager import chain, not a library swap. The skill's ranked list starts with "lazy routes for everything except the landing route", which was exactly the trap: the landing route carried the whole table stack. Proposed additions:

- `audit.mjs` lead: any `component:` (non-lazy) route, with the size of that component's static import closure when `stats.json` exists.
- `audit.mjs` lead: any single source file over N kB in `main`'s inputs (here `source-fixture.ts`, 119 kB, imported by the app shell for `.length`).
- A ranked-list entry between #1 and #2: "the landing route and the shell are eager by definition, so check what they import."

### 4. Wrapper components around heavy UI-kit components

PrimeNG `p-table` pulled datepicker, inputnumber, paginator, scroller and select (about 400 kB raw) into any chunk that used it, to render a read-only table with no sorting or paging. The fix was a plain `<table>` keeping the component API and CSS. Add a named pattern to `chunk-size.md`: "a design-system wrapper that uses one or two features of a large component". Options at three sizes: (quick) verify with the per-package breakdown, (moderate) plain markup or a lighter primitive while keeping the wrapper API, (project) `@defer` the wrapper. Include the tradeoff for `@defer (hydrate on viewport)` versus removal: hydration deferral keeps the dependency and the JS cost, it just moves it later; removal removes it. The user's stated preference was to keep the main layout light and defer heavy parts with placeholders, so the skill should present both, and ask which fits the feature.

### 5. `@defer` above and below the fold, applied to a real page

`loading.md` and `ssr.md` cover triggers and `hydrate` triggers well (they are the reference the agent should have opened). Gaps seen in practice:

- No guidance for deciding whether a component is above the fold on a given page. The agent had to guess whether the home table was visible; it was below a full-viewport hero at 1440 px. Tell the agent to check in the running browser at 390 and 1440 px, and give the CLS rule that follows.
- No note that on a prerendered static site the server HTML is always present, so a `@defer` placeholder plus `hydrate` trigger costs no layout shift, while a client-only `@defer` does.
- Nothing about how a deferred read-only table should degrade before hydration (sorting and filtering do nothing until hydrated). Add one sentence.

### 6. Measurement setup: give a default and the traps

`measurement-automation.md` asks questions but proposes no default. The user wanted a repeatable system that keeps reports in a clean per-commit form and compares them. What was built and worked: repo-local pinned `lighthouse` (not `npx --yes`), median of 3 runs per URL on mobile emulation, one committed JSON per commit (`_architecture/perf-baselines/<short-sha>[-dirty].json` with commit, tool versions, per-page score/LCP/FCP/TBT/CLS/transfer, and bundle sizes from `stats.json`), a `--compare` command, absolute limits as printed targets and only regressions against the baseline as failures. Add this as the default proposal, with the questions kept for choices that differ. Also add the traps found:

- **Check the preview server first.** A static server without compression, or one that serves the client-rendered fallback for `/route/` instead of `route/index.html`, makes every metric about 2x worse and hides real regressions. Verify with `curl -H "Accept-Encoding: br"` and a byte-size comparison before recording a baseline.
- **Lighthouse on Windows** exits non-zero with `EPERM` deleting its temp Chrome profile after the report is written. Treat the report file as success.
- **Runner mismatch.** A baseline recorded on a developer machine is not comparable with a CI runner. Keep the CI Lighthouse step non-blocking until a baseline recorded on the runner is committed.
- **Dirty baselines.** Record the commit hash and a `-dirty` marker, and tell the user to re-record after committing.
- **One run is noise.** A single-run compare flagged a TBT regression (192 to 406 ms) that a 3-run median did not.

### 7. A failed build writes nothing, including `stats.json`

To inspect a build that fails on budgets or prerendering, the agent tried `--prerender=false`, `--output-mode server` and `--no-server`; with `outputMode: static` none of them help. What worked: fix the actual blocking error (here a parameterised redirect route needed `{ path: 'learn/:topic', renderMode: RenderMode.Client }` in `app.routes.server.ts`) or build the development configuration with `--optimization --stats-json`. Add to `build-and-deploy.md` under the stats section, with the `dist/<project>/stats.json` location (not `browser-stats.json`). Add to `ssr.md`: a redirect route with a param plus a `**` prerender entry fails the build.

### 8. Audit script

- The one `high` finding was a false positive: `@for (chip of filterChips(); track chip)` and `track color` where the items are strings. Tracking a primitive is correct. Only flag identity tracking of object-typed items, or downgrade to `info`.
- No finding for the things that mattered (items 3 and 4). See above.
- All other findings were correctly `info`. That part works and should stay.

### 9. Things the skill got right and should keep

Detect state before advising; report leftovers without editing (the 51 unused `ChangeDetectionStrategy` imports were reported with line refs and removed only on request); no builds, installs or CI unprompted; keeping `NoPreloading`; the "unverified" lists. The symptom table pointed straight to the right references.

## Open questions the run did not settle

- Do `bundle` and `anyScript` budgets fire on lazy chunks in Angular 22? The largest lazy chunk (669 kB) was under the 700 kB cap, so it was not exercised. One temporary run with a lower cap would answer it.
- Lazy `import()` chunks do appear in `stats.json` as outputs with `entryPoint` (187 of 360 outputs), so a `bundle` budget could match them. Whether it does was not tested.
- Whether the v22 default incremental hydration changes anything on a page with no `hydrate` triggers is still unverified (the reference says so too).

## Facts to correct or add in references (compact list)

- `chunk-size.md`, `build-and-deploy.md`: `stats.json` path is `<outputPath>/stats.json`; lazy chunks carry `entryPoint`; a failing build writes none.
- `build-and-deploy.md`: `anyComponentStyle` recommendation; raw versus transfer note; budget derivation rule.
- `measurement-automation.md`: default setup, preview-server check, Windows Lighthouse EPERM, runner mismatch.
- `ssr.md`: parameterised redirect plus `**` prerender fails the build.
- `SKILL.md`: "open the reference before naming an API" rule; v22 traps near the top; a pointer to the package-manager check before any install.
