# Chunk and bundle size

Reducing initial bundle size and lazy chunk size for the `@angular/build:application` (esbuild) builder, including the chunk a user waits for after clicking a lazy route. Build-tool facts are read from Angular CLI `main` (v22 line). Facts verified on 20/21 are marked as such, everything else on `main` may differ in older versions. Budget defaults, compression and cache headers live in `build-and-deploy.md`. Lazy routes and `@defer` mechanics live in `loading.md`. Preloading lives in `preloading.md`.

## Triage first

1. Build production with `statsJson` on. Ask which problem it is: big initial bundle, one big lazy chunk, or slow navigation to a lazy route.
2. Offer options at three sizes and say what can be done now versus logged for later. Users often cannot fix the big items immediately.
3. Automate detection only. Ask before any swap, threshold, locale removal or loading-strategy change.

| Tier | Effort | Examples |
|---|---|---|
| Quick | minutes to an hour | `statsJson`, direct imports instead of barrels, diagnostic `namedChunks`, a warning-level budget |
| Moderate | hours to days, a few files | `@defer` a heavy component, lazy `import()` of a library, lodash or moment replacement, flatten nested lazy routes |
| Project | days to weeks, needs testing | replace a chart/editor/PDF library, drop CommonJS dependencies, re-cut feature boundaries, locale strategy |

Safe to automate (read-only): generate the stats file, list the largest chunks and their inputs grouped by package, grep for `from 'lodash'`, `from 'moment'`, `import * as`, barrel `index.ts` re-exports and `registerLocaleData`, read build warnings for CommonJS, compare raw sizes between two builds.

Needs the user: swapping a library (API and behavior differences), budget thresholds (a product call), removing locales, anything that changes visible loading states, CDN and server config (outside the repo).

## How chunks form

- The builder always runs esbuild with `splitting: true` for the browser bundle. Lazy chunk names are `chunk-<hash>.js`, or `<name>-<hash>.js` with `namedChunks: true` (default `false`). Verified on `main`.
- esbuild treats each dynamic `import()` target as an extra entry point. Code reachable from two or more entries goes into one shared chunk and is never duplicated. Code reachable from one entry stays in that entry's chunk.
- A large lazy chunk is therefore one of: a feature that legitimately imports a heavy library, a shared chunk that accumulates everything two or more routes touch, or a barrel import pulling unrelated modules into one entry. Decide from the stats file, not by guessing.
- `@defer` compiles to a dynamic `import()` per component, directive or pipe in the block. Only standalone declarations defer. A dependency referenced outside the block in the same file, or in a `ViewChild` query, stays eager.
- Barrel pitfall: importing a component through an `index.ts` keeps it in the main bundle regardless of `@defer`, because the bundler sees the barrel as one module. Import from the component file.
- `vendorChunk` and `commonChunk` do not apply to this builder (migration guide).

## Measure

1. `ng build` with the `statsJson` option (schema default `false`). Observed on 22.1.6 (real run, 2026-09-21): one `dist/<project>/stats.json`, not in `browser/`, holding browser outputs (`.js`, `.css`) and server outputs (`.mjs`) together. It is the esbuild metafile itself. Source on `main` suggests `browser-stats.json` and `server-stats.json`, so check which exists. Lazy chunks carry `entryPoint` (187 of 360 outputs in that run), which is how scripts map a chunk to its source file. **A failing build writes no stats file**, see `build-and-deploy.md`.
2. Open it in https://esbuild.github.io/analyze/ (Treemap, Sunburst, Flame).
3. Sort outputs by size. For the target chunk, group its inputs by `node_modules/<pkg>`: `node scripts/chunk-packages.mjs <dist/project> <chunk|entry|initial>` does this, including the static-import closure.
4. Check which chunks import the package. If it appears in the initial chunk when a lazy chunk should own it, something eager imports it (a barrel or a root service with a heavy import).
5. Turn on `namedChunks` in a diagnostic build only. It makes the file and Network tab legible. It changes file names and can break post-build scripts.
6. Compare raw bytes before and after each change. Use the same production configuration, so tree-shaking matches.

## Route cost: judge lazy chunks per route

The initial bundle is only half of what a user pays. Opening a lazy route downloads its entry chunk plus every shared chunk it imports statically that is not already in the initial set. That sum is the number to bring to a budget discussion.

`node scripts/route-cost.mjs <dist/project>` reads `stats.json` and prints, per top-level lazy chunk: own size, extra shared size, total, and the source file. `--all` adds nested lazy chunks, `--min-kb=N` cuts noise. It is read-only.

Real run (Angular 22.1.6): initial 536 kB raw, home route 25 kB, search 255 kB, library 212 kB on top of that. Static analysis cannot see when an `import()` runs. If the shell calls `import()` on boot for a data module, that module is effectively initial: pass `--preloaded=<entryPoint substring>` so its closure is not charged to every route. Without the flag, the same build shows home at 127 kB and search at 357 kB because of one shared 101 kB data chunk. Say which assumption you used when you quote a route cost.

Units: the build table prints kB as 1000 bytes. The script prints both kB and KiB.

## Eager routes and shell imports: check first

The landing route and the app shell are eager by definition. Anything they import lands in the initial bundle, so a lazy-route audit that skips them misses the biggest wins. In the reference run both major wins were an eager import chain, not a library swap:

- A landing route (`component:` instead of `loadComponent`) carried a whole table stack (649 kB to 25 kB once lazy).
- A shell component imported a 119 kB data module for one `.length`.

Checks: list `component:` routes (`audit.mjs` does), sort `main`'s inputs by source file size (`audit.mjs` flags application source files over 30 kB inside an initial entry when a stats file exists), and run `chunk-packages.mjs ... initial` to see which packages dominate. Fixes at three sizes: lazy-load the route or module (quick), replace the imported value with a precomputed constant or a small service (moderate), re-cut the data module so the shell imports an index instead of the payload (project).

## Wrapper around a heavy UI-kit component

Pattern: a design-system wrapper that uses one or two features of a large UI-kit component. In the reference run a PrimeNG `p-table` wrapper rendering a read-only table (no sorting, no paging) pulled datepicker, inputnumber, paginator, scroller and select into every chunk that used it, about 400 kB raw. Confirm with `chunk-packages.mjs` on the route chunk: a UI-kit package that dominates a page that visibly uses little of it is the signal.

| Size | Option | Tradeoff |
|---|---|---|
| Quick | Verify with the per-package breakdown, list which features the wrapper really uses | Read-only |
| Moderate | Plain markup or a lighter primitive behind the same wrapper API and CSS classes | Removes the dependency and its JS. Loses features the kit gave for free (keyboard handling, sorting), so check none are used |
| Project | `@defer` the wrapper, with `hydrate on viewport` on prerendered pages | Keeps the dependency and its JS cost and moves it later. It is a loading strategy, not a removal. Placeholder and pre-hydration behavior matter, see `loading.md` |

Ask which fits the feature. A stated preference for keeping the main layout light and deferring heavy parts points at `@defer`. A read-only table with no interactivity points at removal.

## What the user waits for on click

Model (reasoning, not from a fetched source): with the default `NoPreloading`, a click on a lazy route makes the router call `import()`. The wait is at least one round trip, then download, then parse and execute. Nested lazy routes add a round trip per level.

- Chunk size matters less on a warm connection. Shrinking 20 KB to 10 KB changes little because the round trip dominates. Shrinking 300 KB matters on slow links.
- Repeat visits with hashed, cached chunks skip the network for unchanged chunks. Parse cost stays.
- Lazy loading adds requests later, and nested lazy loading at several levels can hurt (Angular docs). Eager-load landing pages, lazy-load the rest.
- Preloading hides the wait but spends bandwidth for users who never visit. See `preloading.md`. Shrinking the chunk or removing a waterfall is often cheaper than adding preloading and helps users who arrive by direct link too.
- `@defer` accepts a `prefetch` trigger clause after the main trigger. Triggers are `idle`, `viewport`, `interaction`, `hover`, `immediate`, `timer`.

Measure with DevTools Network throttled to Fast 4G or Slow 4G and time from click to first render. Add a Performance trace for parse cost. Code splitting reduces payload and main-thread work, which helps INP (web.dev).

## Options by size

### Quick

- Replace barrel imports at the eager/lazy boundary with direct file imports. Low risk.
- Add a warning-level `initial` budget plus an `anyScript` cap slightly above the current largest chunk, then ratchet down. Propose warnings only, never errors, without the owner's agreement.
- Fix whole-library imports that have a named form: `import throttle from 'lodash/throttle'` instead of the root package. `lodash-es` declares `"type": "module"` and `"sideEffects": false`. Per-method packages (`lodash.pick`) are discouraged upstream and grow the bundle through duplicated shared code.
- Audit `@angular/common/locales/*` imports. Only `en-US` ships by default.
- Inspect the `polyfills` array (default `[]`) for entries no longer needed.
- Icons: the Material Symbols font is 295 KB by default and about 1.7 KB with `icon_names` subsetting. `@primeicons/angular` and `lucide-angular` icons are standalone components, importable individually.

### Moderate

- `@defer` heavy below-the-fold or interaction-gated components (charts, editors, modals) with a `@placeholder`. Watch layout shift and cascading loads, both warned about in the docs.
- Lazy `import()` inside a service for libraries with no template surface (PDF export, editor).
- Flatten nested lazy routes to one level to remove chunk waterfalls.
- Move a heavy module that two routes share behind its own `import()` so it stops inflating the shared chunk, or accept it because it downloads once.
- Replace moment for formatting with `Intl.DateTimeFormat` or `Intl.RelativeTimeFormat`, or with date-fns or luxon for arithmetic. Needs a decision.

### Project

- Re-cut feature routes so each heavy library belongs to exactly one lazy route.
- Replace the largest single dependency (chart, editor, PDF) after measuring its `bytesInOutput` share.
- Drop CommonJS dependencies. The CLI warns about them because they hinder optimization. `allowedCommonJsDependencies` silences the warning and does not fix it.
- `externalDependencies` excludes packages from the bundle and expects them at runtime (import map or CDN). High risk (versions, CSP), so a user decision.
- Removing zone.js means a zoneless migration. That is a project, not a size fix.

## Budgets and size

### What a budget compares

- Budgets compare raw output bytes. The build table's estimated transfer size uses Brotli and is display-only, never used for budgets. In the reference run 536 kB raw was 130 kB transferred, so a 500 kB raw budget is not a "500 kB download".
- `initial` sums JS and CSS of initial chunks. A `bundle` budget matches by chunk `name`, and names under esbuild come from the metafile `entryPoint`. Lazy chunks do appear in `stats.json` with `entryPoint`, so a `bundle` budget could match them, but this was not tested.
- `anyScript` ("any script, individually") needs no chunk name and is the suggested cap for "no lazy chunk above N kB". Whether it fires on lazy chunks in v22 was not exercised (the largest lazy chunk was under the cap). Test with one temporary run at a lower cap.
- `anyComponentStyle` conflict: angular.dev says 2 kB warning and 4 kB error, the generated template says 4 kB and 8 kB. A project on the 2/4 kB numbers had two real components at 2.4 and 2.8 kB warn on every build. Recommend 4/8 kB unless there is a reason, and read the project's `angular.json` first.
- Read thresholds from the project's `angular.json`. Defaults and compression are in `build-and-deploy.md`.

### Sizing a first budget

Reference points, each unverified until checked (move a number out of the unverified list only with a source and date):

- The CLI-generated default for a strict app is `initial` 500 kB warning and 1 MB error, raw (`build-and-deploy.md`, read from the schematic on `main`).
- A guideline of about 170 kB compressed (gzip) critical JavaScript on the first route is quoted for 2026 low-end mobile (user-supplied answer, 2026-09-22, whose sources were blog posts, not re-checked). Use it as a stretch target next to the raw budget derivation below, and say where it comes from.
- Lighthouse has its own transfer-size audits. Read its current docs before citing thresholds.

Derivation rule for a project with no meaningful budget:

1. Build production with `statsJson` and read the initial raw total (`route-cost.mjs` prints it).
2. Warning at total x 1.15, error at total x 1.4, rounded up. The reference run used 536 kB to 600 kB warning and 750 kB error.
3. Ratchet down after each win. Lower the numbers in the same change that shrinks the bundle.
4. `anyScript`: set the cap just above the largest lazy chunk you accept. If one chunk is intentionally big (a 669 kB mermaid chunk that loads only on documents containing a diagram), set the cap just above it and document the exception. Do not raise the cap for every chunk to fit one.
5. A budget set in an empty-app phase and never derived from a build fails on the first real build. Replace it with the derived numbers.

Ask, then propose: the user owns the number, but bring a concrete proposal to that conversation ("warn 600 kB, error 750 kB, because the build is 536 kB raw, 130 kB transferred") instead of asking "what number do you want".

## Pitfalls

- Barrels defeat both `@defer` and lazy routes.
- A `providedIn: 'root'` service that imports a heavy library pulls it into every consumer's chunk.
- `import * as` of a large library keeps unused exports when the library is CommonJS or lacks `sideEffects: false`.
- Moving code to `@defer` without a stable placeholder causes layout shift.
- Turning on `namedChunks` in production changes file names.
- Setting budget errors before the team agrees breaks CI on unrelated work.
- The tree-shaking claims for lodash-es and moment under esbuild are expectations until checked in the stats file.

## Read more

- https://angular.dev/tools/cli/build (budgets, CommonJS)
- https://angular.dev/guide/templates/defer
- https://angular.dev/best-practices/performance/lazy-loaded-routes
- https://angular.dev/tools/cli/build-system-migration
- https://raw.githubusercontent.com/angular/angular-cli/main/packages/angular/build/src/builders/application/schema.json (option defaults)
- https://esbuild.github.io/analyze/ and https://esbuild.github.io/api/#splitting
- https://raw.githubusercontent.com/evanw/esbuild/main/docs/architecture.md (code splitting)
- https://web.dev/articles/reduce-javascript-payloads-with-code-splitting
- https://lodash.com/per-method-packages and https://momentjs.com/docs/#/-project-status/

## Unverified, check before relying

- Whether a `bundle` budget matches lazy chunks by name, and whether `anyScript` fires on them in v22. Lazy chunks do carry `entryPoint` (observed on 22.1.6). What `[name]` is for a pure shared chunk with `namedChunks` is untested.
- The 170 kB compressed guideline comes from blog-level sources, not Angular or web.dev docs. The 1.15 and 1.4 budget multipliers are a rule of thumb from one run, not a standard.
- Whether code shared by the initial entry and a lazy entry stays in the initial bundle. It follows from the entry-combination rule but no doc states it.
- The click-wait model above, the round-trip-floor claim, and that parse cost follows raw size. These are reasoning, not sourced.
- Whether 20.x and 21.x write `stats.json` (seen on 22.1.6) or `browser-stats.json` (seen in `main` source), and share the same defaults.
- Whether `lodash-es` fully tree-shakes and how esbuild treats moment's dynamic locale lookup. The documented moment fixes are webpack-only.
- Per-locale bundling of `@angular/common/locales/*`, and `sideEffects` semantics for third-party packages.
- Sizes of date-fns, luxon and chart/editor/PDF libraries. None were fetched, so measure with the stats file.
- The `--stats-json` flag spelling. The option `statsJson` is confirmed and the kebab-case flag follows CLI convention.
