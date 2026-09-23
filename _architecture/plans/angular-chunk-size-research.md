# Angular chunk and bundle size: research notes

Scope: Angular 20-22, `@angular/build:application` (esbuild). Raw material for a general-knowledge performance advisor skill.
Research date: 2026-09-21. Sources fetched this session via ctx7 (Angular library IDs `/websites/angular_dev`, `/angular/angular-cli`) and WebFetch (results were summarized by a small model, so quotes are close but not guaranteed verbatim).

Legend: **[V]** = verified from a fetched source (URL given). **[U]** = unverified, not confirmed by any fetched source; treat as a hypothesis to test in the user's own build. Nothing in a [U] item was filled in as fact.

Related: `angular-preloading-research.md` (same folder) covers preloading strategies; not repeated here.

---

## 0. Sizing the advice: three tiers and what can be automated

| Tier | Typical effort | Examples |
|---|---|---|
| Quick win | minutes to an hour, config or one-line import change | enable `statsJson`, add budgets, `namedChunks` in a diagnostic build, replace barrel import with direct import, enable Brotli at server/CDN, check cache headers |
| Moderate | hours to days, code change in a few files | `@defer` a heavy component, swap `moment` for `Intl`/date lib, `lodash` to modular imports, split a fat lazy route into nested lazy children, lazy-load a chart/editor via `import()` |
| Planned project | days to weeks, needs a decision and regression testing | replace a charting/editor/PDF library, drop CommonJS dependencies, restructure feature boundaries so shared code stops landing in one big shared chunk, locale strategy, monorepo barrel cleanup |

Safe to automate (read-only or diagnostic, no behavior change): generate `stats.json`, parse it and list largest chunks / top inputs per chunk, detect CommonJS warnings in build output, grep for `from 'lodash'`, `from 'moment'`, `import * as`, barrel `index.ts` re-exports, list `registerLocaleData` calls, check response headers of a deployed URL, compare raw sizes between two builds.

Needs the user's decision: swapping a library (API/behavior differences), removing locales, changing loading strategy (`@defer` triggers change UX), setting budget thresholds (what is acceptable is a product call), CDN/server config (outside repo), any change touching visible loading states.

---

## 1. How the application builder splits chunks

Facts:
- esbuild code splitting: "Code shared between multiple entry points is split off into a separate shared file that both entry points import." Async `import()` expressions are loaded separately. Works only with ESM output; esbuild itself calls splitting "still a work in progress" with a known ordering issue for imports across chunks. [V] https://esbuild.github.io/api/#splitting
- The Angular builder migration guide says `vendorChunk` and `commonChunk` options should be removed when moving to the esbuild builder, describing them as "a performance optimization which is no longer needed." It does not explain how the new builder places shared code. [V] https://angular.dev/tools/cli/build-system-migration
- `@defer` compiles to a dynamic `import()` per component/directive/pipe used in the block. Only standalone declarations can be deferred; non-standalone dependencies stay eager. A dependency referenced outside the `@defer` block in the same file (or in a `ViewChild` query) is not deferred. [V] https://angular.dev/guide/templates/defer
- Route lazy loading: `loadComponent` and `loadChildren` create separate chunks; "nested lazy loading at multiple levels... can significantly impact performance"; eager-load the landing pages, lazy-load the rest. [V] https://angular.dev/best-practices/performance/lazy-loaded-routes

Not verified (no fetched source explains it): the exact esbuild heuristic for what goes into a shared chunk versus being duplicated. General esbuild behavior [U]: a module imported by two or more lazy entry points is hoisted into a shared chunk named `chunk-<hash>.js`; a module used by exactly one lazy entry stays in that entry's chunk; a module used by the eager entry and a lazy entry stays in the eager chunk. Consequence [U]: a large lazy chunk is usually (a) a feature that legitimately imports a heavy library, (b) a shared chunk that accumulates everything two or more routes touch (a "common" bucket that grows as routes are added), or (c) a barrel import that pulls unrelated modules into one entry. Verify by reading the metafile (section 2), not by assuming.

- How to measure: `stats.json` inputs per output chunk (section 2).
- Fixes: see sections 3, 4, 5. Risk: low to moderate (behavior of loading order). Effort: moderate to planned.
- Docs: links above.

---

## 2. Reading stats.json for a lazy chunk

Facts:
- `statsJson` builder option (default `false`): "Generates a 'stats.json' file which can be analyzed with https://esbuild.github.io/analyze/." [V] https://raw.githubusercontent.com/angular/angular-cli/main/packages/angular/build/src/builders/application/schema.json
- The esbuild analyzer takes an esbuild metafile and offers Treemap, Sunburst and Flame charts. [V] https://esbuild.github.io/analyze/
- CLI flag: `ng build --stats-json` [U: flag name not confirmed by a fetched page; the schema option `statsJson` is confirmed]. Output location [U]: `dist/<project>/stats.json`.
- Whether Angular's `stats.json` is byte-identical to an esbuild metafile: [U]. The schema text says it is analyzable with the esbuild analyzer, which implies it is metafile-shaped.

Procedure (safe to automate) [U on exact JSON shape, based on esbuild metafile format; check against the real file]:
1. Build with `statsJson` on (production config, so tree-shaking matches production).
2. Metafile has `outputs.<file>.bytes`, `outputs.<file>.inputs.<path>.bytesInOutput`, `outputs.<file>.imports[]` (with `kind: import-statement | dynamic-import`) and `entryPoint`. Sort outputs by `bytes`; for the target lazy chunk sort its `inputs` by `bytesInOutput`.
3. Group inputs by package (`node_modules/<pkg>`) to see which dependency dominates.
4. Read `imports` of the eager entry: entries with `kind: import-statement` are eager, `dynamic-import` are lazy.
5. Cross-check: if a package appears in the eager chunk AND a lazy chunk you expected to own it, something eager imports it (barrel, root service, `providedIn: 'root'` service with a heavy import).

Effort: quick win. Risk: none. Link: https://esbuild.github.io/analyze/ ; metafile docs https://esbuild.github.io/api/#metafile (page section text was truncated in the fetch: not verified beyond existence).

---

## 3. Chunk granularity: small entry, `@defer`, nested lazy children

Facts:
- `@defer` triggers: `idle` (default), `viewport`, `interaction`, `hover`, `immediate`, `timer`; prefetch trigger separated with `;` (`@defer (on interaction; prefetch on idle)`). [V] https://angular.dev/guide/templates/defer
- Barrel pitfall: importing via an index file "defeats code splitting because bundlers see the barrel as a single module and keep all its exports together, so your component ends up in the main bundle regardless of `@defer`." Import directly from the component file. [V] same page
- Docs warn against cascading loads (waterfalls) and layout shift. [V] same page
- Nested lazy routes at multiple levels can hurt performance (waterfall of chunk requests). [V] lazy-loaded-routes page

Options by size:
- Quick: replace barrel imports at the eager/lazy boundary with direct file imports. Risk low.
- Moderate: `@defer` heavy below-the-fold or interaction-gated components (charts, editors, modals) with a `@placeholder`; use `import()` in a service for non-template libraries (PDF export, editor). Risk: placeholder/layout shift, test `@defer` in tests (`TestBed` defer behavior not verified here [U]).
- Planned: re-cut feature routes so heavy libraries belong to exactly one lazy route; keep nesting to one level to avoid waterfalls.

Tradeoff, quoted: lazy loading "adds future data requests that could be undesirable." [V] lazy-loaded-routes page

---

## 4. Budgets: `initial` vs per-chunk `bundle`

Facts:
- Budget types: `initial`, `bundle`, `allScript`, `all`, `anyScript`, `anyComponentStyle`, `any`; `bundle` needs `name`. Example thresholds `250kb` warning / `500kb` error for `initial`. [V] https://angular.dev/tools/cli/build ; schema URL in section 2
- `initial` sums initial chunks. `bundle` matches chunks whose `names` include the budget's `name`. [V from the CLI source file `bundle-calculator.ts`, fetched via summarizer; that file may reflect webpack-era `chunk.names` logic, so whether `bundle` budgets match esbuild lazy chunks by their names is UNVERIFIED for the application builder]. Consequence [U]: per-chunk `bundle` budgets likely need stable names, hence `namedChunks`.
- Calculator summary said sizes are uncompressed (raw) sizes with no gzip logic. [V-ish, same source, needs a direct read to confirm] So budgets compare raw bytes, not transfer size.
- `anyScript` ("any script, individually") is a chunk-agnostic way to cap every JS file, including lazy chunks, without naming them. [V from calculator summary] This is the safest suggested default for "no lazy chunk above N kb" [proposal, untested].

Options: Quick: add `initial` budget plus `anyScript` cap at a value slightly above the current largest chunk (ratchet down later). Moderate: named `bundle` budgets for critical routes once `namedChunks` naming is confirmed. Risk: budget errors fail CI; user chooses thresholds. Do not auto-set errors, only propose warnings.

---

## 5. `namedChunks`

- Option `namedChunks`, default `false`, "Use file name for lazy loaded chunks." [V] schema URL section 2
- Production defaults to unnamed to keep output small/stable [U for esbuild builder; the CHANGELOG about `namedChunks` default flip to `false` refers to the webpack browser builder. [V] https://github.com/angular/angular-cli/blob/main/CHANGELOG.md]
- Use: turn on in a diagnostic build to make `stats.json` and Network tab legible. Risk: file names change, breaks post-build scripts that assume names (documented for the webpack move, likewise plausible here [U]). Effort: quick.

---

## 6. Tree-shaking failures

Facts:
- Angular docs: prefer ESM; "CommonJS modules can prevent bundlers and minifiers from optimizing those modules effectively, which results in larger bundle sizes"; the CLI warns and `allowedCommonJsDependencies` silences the warning (silences, does not fix). [V] https://angular.dev/tools/cli/build
- esbuild: "Tree shaking works with ECMAScript modules but not with CommonJS modules"; `sideEffects` in package.json, `/* @__PURE__ */` annotations, and `ignoreAnnotations` affect it. [V, summarizer text] https://esbuild.github.io/api/#tree-shaking (detail of `sideEffects` semantics not shown in fetch: verify in docs).
- The builder's `optimization` (default `true`) includes minification, tree-shaking, dead-code elimination. [V] schema.

Failure patterns (all [U] beyond the above; confirm with stats.json inputs):
1. CommonJS dependency imported: the whole file lands in the chunk. Detect: build warnings; input path ends `.cjs`/no `module`/`exports` field. Fix: ESM-build of the same lib, or swap lib.
2. Package lacking `"sideEffects": false`: unused modules remain if any top-level code runs. Detect: input present with tiny use. Fix: newer version, or swap; do not patch node_modules.
3. Barrel file (`index.ts` re-exports) in the app's own code at the eager/lazy boundary: [V for `@defer`] a lazy component reached through a barrel from eager code ends in the eager chunk.
4. Whole-library imports: `import * as _ from 'lodash'`, `import moment from 'moment'`, `import * as echarts`, full icon set. Detect: grep + inputs by package.
5. Side-effectful top-level code in own libraries (registering things at import time) keeps modules alive.

Risk of fixes: low for import path changes, moderate for swapping. Effort: quick to planned.

---

## 7. Heavy dependency swaps

Only lodash and moment were checked in a fetched source:

| Dependency | Verified | Options |
|---|---|---|
| lodash | Per-method packages (`lodash.pick` etc.) are "discouraged and will be removed in v5"; increase bundle size because of duplicated shared code. Direct method imports (`lodash/throttle`) include only needed code. The page has no lodash-es guidance. [V] https://lodash.com/per-method-packages | Quick: `import throttle from 'lodash/throttle'` or, [U] `lodash-es` (ESM, tree-shakable by name imports; confirm ESM/sideEffects flag in package.json). Moderate: replace with native (`structuredClone`, `Array.prototype` methods, `Object.groupBy` [U availability by browserslist]). |
| moment | "legacy project in maintenance mode"; "Moment uses a dynamic locale lookup, so Webpack includes every Moment locale by default... produces the largest bundle" (webpack-specific advice, esbuild behavior [U]). Luxon appears as an option on the page. [V] https://momentjs.com/docs/#/-project-status/ | Moderate: `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat` for formatting, Luxon/date-fns/Day.js [U sizes: measure with stats.json] for arithmetic. Planned if used pervasively (API differences, time zones). |
| Icon sets | not verified | [U] import individual icons instead of a font/whole set; check whether the icon package is ESM with per-icon modules; font-based sets ship all glyphs regardless of use. |
| Charting (echarts, highcharts, chart.js), editors (monaco, quill, ckeditor, tinymce), PDF (pdf.js, jsPDF) | not verified | [U] all are typically the largest single inputs; standard tactics: lazy `import()` on demand, per-module/tree-shakable registration (chart.js, echarts custom builds), load editor only when user opens it. Check each library's own docs; none fetched. |
| Locale data | see section 9 | |

Each swap: measure before/after with stats.json bytesInOutput per package. Risk: moderate (API/behavior), needs user decision. Automatable: detection only.

---

## 8. Intl / date alternatives

- Native `Intl` has no bundle cost (browser built-in); locale coverage depends on the browser [U, not fetched]. Angular's `DatePipe`/`CurrencyPipe` use locale data via `LOCALE_ID`; pipe docs do not discuss bundle size. [V] https://angular.dev/guide/i18n/format-data-locale (fetch did not contain `registerLocaleData` or size info)
- Whether Angular's locale data is bundled only for locales you register/import: [U]. Verify via `stats.json` (search inputs for `@angular/common/locales`).
- Options: quick: audit imports of `@angular/common/locales/*`, remove locales not used [needs decision on supported locales]; moderate: replace moment with Intl for formatting.

---

## 9. Optimizing third-party imports (summary checklist)

Detect: inputs by package in stats.json; grep `import \* as`, default imports of large libs; CommonJS warnings. Fix order: (1) direct/named ESM import, (2) lazy `import()` at the use site, (3) lighter alternative, (4) replace. `externalDependencies` builder option excludes deps from the bundle and expects them at runtime (e.g. import maps/CDN). [V schema] Risk: high (runtime resolution, versions, CSP) — planned tier, user decision.

---

## 10. Polyfills

- `polyfills` option: "A list of polyfills to include in the build" (default `[]`, file path or module specifier). [V schema]
- Angular default polyfill is `zone.js` in zone-based apps; removing it requires zoneless [U for Angular 20-22 status, not fetched: verify at https://angular.dev]. A zoneless migration is a planned project, not a chunk-size quick fix.
- Quick: inspect `polyfills` array for entries no longer needed for the browserslist; check `.browserslistrc` (a wider range may cause more downleveling) [U].

---

## 11. Transfer size vs parsed size

- Compression: "Wherever possible, prefer Brotli over gzip." Gzip levels 1-9, Brotli 0-11; static (pre)compression can use maximum levels, dynamic compression needs mid-range. Cited ratios 65-86% across Angular/jQuery/Lodash. [V] https://web.dev/articles/reduce-network-payloads-using-text-compression
- Angular budgets compare raw (uncompressed) sizes per calculator summary [see section 4]. A large raw chunk that compresses well may cost less on the wire, but parse/compile cost follows raw size [U: not from a fetched source, general browser behavior].
- Measure: raw bytes from build output; wire bytes from DevTools Network (Size vs transferred) or `curl -H 'Accept-Encoding: br' -sI`; CPU parse cost via a Performance trace.
- Fix: server/CDN Brotli (quick, outside repo, user/ops decision), pre-compress at build for static hosting (moderate, host-specific). Risk low.

---

## 12. Caching: hashed filenames and repeat visits

- Hashed/versioned assets: `Cache-Control: max-age=31536000` (optionally `immutable`, ignored by some browsers); HTML: `no-cache` with ETag/Last-Modified. [V] https://web.dev/articles/http-cache
- Builder `outputHashing` default in schema is `"none"`; production configuration in generated workspaces sets `"all"` [U: not fetched; verify in the user's `angular.json`]. `ng build` production should be checked to have hashing on.
- Benefit: an unchanged lazy chunk stays cached across deploys, but only if its hash is stable; a chunk whose content depends on a shared chunk's changes is invalidated when shared code changes [U]. Splitting code so rarely-changing vendor code sits apart improves cache hit rate [U]; no `vendorChunk` in the new builder per migration guide [V].
- Quick: verify headers on deployed URL. Moderate: fix CDN cache rules. Automatable: read-only header check.

---

## 13. Chunk size and the click-to-navigate wait for lazy routes

Model [U, reasoning not from a fetched source]: wait = discover chunk (after click, router calls `import()`) + one round trip (RTT + TLS/connection reuse) + download (size / bandwidth) + parse/execute + nested chunk waterfalls. For small chunks RTT dominates ("round-trip floor"): shrinking a 20 KB chunk to 10 KB does little; shrinking a 300 KB chunk matters on slow links. Waterfalls (chunk imports another lazy chunk) multiply RTTs.

Verified adjacent facts: lazy loading adds requests later [V lazy-loaded-routes]; nested lazy loading can hurt [V]; `@defer` supports `prefetch` triggers [V].

Measure: DevTools Network throttled to "Fast 4G"/"Slow 4G", record click to first render; Performance trace; INP impact discussed in https://web.dev/articles/reduce-javascript-payloads-with-code-splitting [V: code splitting reduces payload, "freeing up the main thread", helps INP].

Fixes by size: quick: preloading (see `angular-preloading-research.md`; not re-verified here); moderate: `@defer ... prefetch on idle/hover`, merge tiny chunks or flatten nested lazy levels; planned: reorganize routes to cut waterfalls. Tradeoff: preloading spends bandwidth for users who never visit the route.

---

## Proposed skill content: `references/chunk-size.md`

Frontmatter-free reference file; each topic follows the same template. Keep [U] items labeled "check in the user's build".

```
# Chunk and bundle size

## Triage (always first)
- Build production with statsJson. Ask: is the problem initial size, one big lazy chunk, or navigation latency?
- Tiers: quick win / moderate / planned. Say what can be done now and what to log for later.
- Automate: detection only. Ask before: swaps, budget thresholds, removing locales, loading-strategy changes.

## 1 How chunks are formed (esbuild splitting, shared chunks, @defer, loadComponent/loadChildren)
  Measure: stats.json outputs + imports kind. Options: direct imports, @defer, one-level lazy.
  Pitfalls: barrels, non-standalone deps, waterfalls. Links: esbuild splitting, angular.dev defer, lazy-loaded-routes.

## 2 Reading stats.json for a chunk
  Steps (sort outputs by bytes, inputs by bytesInOutput, group by package, check who imports it eagerly).
  Tool: esbuild.github.io/analyze. Script idea: scripts/ chunk report (read-only).

## 3 Budgets
  initial + anyScript first (warning only); named bundle budgets need namedChunks; raw sizes, not gzip.
  Pitfall: setting errors without owner agreement.

## 4 namedChunks (diagnostic only) 
## 5 Tree-shaking failures (CJS, sideEffects, barrels, whole-lib imports) + allowedCommonJsDependencies caveat
## 6 Dependency swaps (lodash, moment, icons, charts/editors/PDF, locales): measure bytesInOutput per package first
## 7 Intl/date + locale data
## 8 Third-party import optimization checklist (named ESM import -> lazy import() -> lighter lib -> replace; externalDependencies = high risk)
## 9 Polyfills (audit array, browserslist; zoneless = planned project)
## 10 Transfer vs parse size (Brotli at server/CDN; raw vs wire vs CPU)
## 11 Caching (outputHashing, immutable long max-age for hashed files, no-cache for index.html)
## 12 Navigation latency of lazy routes (RTT floor vs size, waterfalls, prefetch/preload, link to preloading reference)

Per topic: Measure | Options (quick / moderate / planned) | Automatable? | Needs user decision | Pitfalls | Links
```

Link list:
- https://angular.dev/tools/cli/build (budgets, CommonJS)
- https://angular.dev/guide/templates/defer
- https://angular.dev/best-practices/performance/lazy-loaded-routes
- https://angular.dev/tools/cli/build-system-migration
- https://raw.githubusercontent.com/angular/angular-cli/main/packages/angular/build/src/builders/application/schema.json (option defaults)
- https://esbuild.github.io/api/#splitting , #tree-shaking , #metafile , https://esbuild.github.io/analyze/
- https://web.dev/articles/reduce-javascript-payloads-with-code-splitting
- https://web.dev/articles/reduce-network-payloads-using-text-compression
- https://web.dev/articles/http-cache
- https://lodash.com/per-method-packages , https://momentjs.com/docs/#/-project-status/

## Gaps to close before shipping the skill
1. esbuild shared-chunk placement rules: no fetched source; read esbuild docs/changelog or test with a toy build.
2. Whether `bundle` budgets match esbuild-builder lazy chunk names (calculator file read was via summarizer and looked webpack-era).
3. Whether Angular budgets measure raw only (summary says so; confirm in source).
4. `sideEffects` semantics text and metafile field reference (esbuild page sections came back truncated).
5. Icon, charting, editor, PDF library guidance: no dependency docs fetched.
6. `preloadDependencies`, `--stats-json` flag, default `outputHashing` in generated production config, Angular locale data bundling, zone.js/zoneless status in 20-22: not fetched.
7. ctx7 returned mostly generic snippets; the 3-command cap was used up.
