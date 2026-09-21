# Research Report: Angular Performance Optimization Skill (SKILL.md raw material)

## Review (2026-09-21)

Implemented as `plugins/jookoi-dev/skills/jookoi-angular-performance/`. Checked against angular.dev (Context7) and the official `angular-developer` skill before writing.

Confirmed: OnPush default since v22, Signal Forms stable in v22, incremental hydration on by default with `provideClientHydration()` (opt out via `withNoIncrementalHydration()`).

Corrected or changed in the skill:
- **Template-call advice would flag correct code.** Signal reads (`{{ count() }}`) are calls too. The skill and audit script only flag calls with arguments and heavy getters, and warn that `no-call-expression` may need `allowList` tuning.
- **Barrel claim overstated.** esbuild tree-shakes side-effect-free barrels. The real failure is eager code importing a lazy feature's barrel. Skill says verify in `stats.json` instead of mass-rewriting imports.
- **Version table gaps.** v20 also stabilized incremental hydration, replaced `provideServerRouting` with `provideServerRendering(withRoutes())`, and deprecated `@angular/animations` (20.2). `@defer` was dev preview in v17, stable in v18. `NgOptimizedImage` stable in v15 (the "13.4/14.3" note was garbled).
- **Missing high-value items added:** virtual scrolling for long lists, `eventCoalescing` for apps still on zone.js, animations package cost, font and critical-CSS inlining, `@defer` dependency rules (standalone, not referenced elsewhere in the file), HTTP transfer cache, legacy webpack builder detection.
- **Off-topic items dropped:** `inject()` over constructor DI and most Signal Forms material are not performance advice.
- **Unverified, hedged in the skill:** the `Default` → `Eager` rename and the 12-month cadence / v23 date. The skill tells the agent to check installed typings rather than asserting the name.
- **Structure:** pitfalls and automation merged into `SKILL.md` and `references/measuring.md` (4 references, not 6). The proposed audit steps became a runnable zero-dependency `scripts/audit.mjs` with a staleness check against `BASELINE_MAJOR`.
- **Placement:** kept inside `jookoi-dev`, not a separate plugin, per the repo rule to split only for independent distribution/versioning/audience.
- Caveat about unverified repo conventions is resolved: frontmatter is `name` + `description` only, provenance lives in the sibling `README.md`, same as `jookoi-fastled`.

## TL;DR
- **Target Angular 22 (stable, released June 3, 2026) as the baseline.** The single biggest shift affecting all performance advice is the "signal-first / zoneless" model: new apps are zoneless with OnPush by default, signals/`computed`/`resource`/`httpResource` are stable, and Signal Forms graduated to stable in v22. Write the skill against this, but make it degrade gracefully for teams still on v17–v20.
- **The highest bang-for-buck wins, in order:** (1) route-level lazy loading + correct bundle budgets, (2) `@defer` for below-the-fold/heavy components, (3) `NgOptimizedImage` with `priority` on the LCP image, (4) OnPush + signals (and eventually zoneless) to cut change-detection cost, (5) SSR + hydration + incremental hydration for LCP/FCP. Measure before/after with Lighthouse + Angular DevTools.
- **Structure the skill to match the repo:** one lean `SKILL.md` (minimal `name`/`description` frontmatter) plus split reference files, and put the version fingerprint/provenance in a sibling `README.md` — that is exactly what this repo's `jookoi-fastled` skill already does. Automate audits with `ng build --configuration production` budgets, `--stats-json` bundle analysis, Lighthouse CI, and `angular-eslint` template rules.

---

## Key Findings

### Version landscape (fingerprint this)
- **Angular 22** is the current stable release, published **June 3, 2026** (confirmed by blog.angular.dev's "Announcing Angular v22" and Wikipedia's infobox "Stable release: 22.0.0 / 3 June 2026"; current patch v22.0.1). angular.dev itself is served at v22 (docs footer reports build "v22.1.7"). Angular 21 shipped November 2025; Angular 20 in May 2025.
- **Release cadence changed as of v22 — flag this in the fingerprint.** Angular is moving *off* the long-standing 6-month major cadence. Per angular.dev/reference/releases: "Until Angular v22, Angular had a 6-month major release cycle, with 1–3 minor releases for each major release." The framework is switching to a **12-month major cadence**: **Angular 23 is now officially targeted for June 2027** (not late 2026), with v22 extended to a full 12-month lifecycle. Support has also expanded: "All major releases are typically supported for **24 months**" (12 months active support + 12 months LTS), up from the previous 18. This means the skill has a *longer* useful shelf life than under the old cadence — but the fingerprint should still key off the installed major, not a calendar date.
- **What changed per major that changes performance advice** (this is the "what changes per major" checklist the fingerprint should track):
  - **v22 (Jun 2026):** signals-first defaults — new components default to OnPush (the old `ChangeDetectionStrategy.Default` was renamed `Eager`); **Signal Forms stable**; `resource()`/`rxResource()`/`httpResource()` stable; Angular Aria (accessible primitives) stable; **selectorless components**; zoneless is the standard path.
  - **v21 (Nov 2025):** **zoneless by default** for new apps (`provideZonelessChangeDetection()` is no longer in the boilerplate because it's the default); Signal Forms + Angular Aria shipped experimental; Vitest test runner.
  - **v20 (May 2025):** `provideZonelessChangeDetection()` (dev preview, stable in 20.2); incremental hydration and route-level render modes stable; `provideServerRendering(withRoutes())` replaces `provideServerRouting`; `@angular/animations` deprecated in 20.2.
  - **v19 (Nov 2024):** incremental hydration (Developer Preview), route-level render modes, `provideServerRouting`; standalone by default.
  - **v18 (May 2024):** event replay, experimental zoneless, deferrable views stabilized; SSR/hydration improvements.
  - **v17 (Nov 2023):** built-in control flow (`@if`/`@for`/`@switch`), `@defer` deferrable views, esbuild/Vite **application builder** became default, standalone-first.
  - **v16 (May 2023):** signals + full-app hydration introduced.
  - **v15 (Nov 2022):** `NgOptimizedImage` stable.
- **Version-sensitive APIs the fingerprint must flag:** `provideZonelessChangeDetection` (name/stability moved across 18→20→21); Signal Forms (experimental v21 → stable v22); `provideServerRendering(withRoutes(...))` vs older `provideServerRouting(...)` split; `@defer` `hydrate` triggers (need SSR+hydration); default change-detection strategy flip in v22.

### 1. Current best practices (Angular 22)
- **Change detection:** Prefer **signals** for state (`signal`, `computed`, `linkedSignal`), `OnPush` for components (default in v22), and **zoneless** (`provideZonelessChangeDetection()`) once state is signal-driven. Angular's own guidance: OnPush skips subtrees; signals tell Angular exactly which view to update; zoneless removes zone.js from the update loop. Removing zone.js also drops its polyfill weight — zone.js v0.14 is roughly **33 KB raw / ~10 KB gzipped** (per PkgPulse and SharpSkill bundle measurements; one developer, Ali El Mufti, cites "~13 KB gzipped") — so treat the figure as "roughly 10–13 KB gzip / ~33 KB raw."
- **Templates:** Use built-in control flow `@if`/`@for`/`@switch`. **`@for` requires `track`** — use a stable unique id (`track item.id`), not `$index` for mutable lists, and never `track item` on object identity that changes each fetch.
- **Data:** Use `httpResource()`/`resource()` for async reads (auto-cancels stale requests, exposes `.value()`/`.isLoading()`/`.error()` signals); keep `HttpClient` in services for mutations. Convert Observables at the edge with `toSignal()`.
- **Async in templates:** Prefer the `async` pipe or `toSignal()` over manual `.subscribe()`; if subscribing manually, use `takeUntilDestroyed()`.
- **DI:** Prefer `inject()` over constructor injection (smaller, works in functions).
- **Build:** Use the esbuild/Vite **application builder** (default since v17); prefer native ESM imports; avoid CommonJS deps (CLI warns — they defeat tree-shaking).
- **Loading:** Route-level lazy loading with `loadChildren`/`loadComponent`; `@defer` for heavy in-view-later components; `NgOptimizedImage` for images; SSR + hydration for content-heavy/SEO routes.

### 2. Biggest bang-for-the-buck (ranked by impact ÷ effort)

| Rank | Optimization | Typical impact | Effort | When it applies |
|---|---|---|---|---|
| 1 | **Route-level lazy loading + bundle budgets** | Large — cuts initial JS, improves FCP/LCP/TTI | Low | Any multi-route app; especially heavy admin/dashboard routes |
| 2 | **`@defer` heavy/below-the-fold components** | Large — smaller initial bundle, defers cost | Low–Med | Charts, maps, editors, comments, anything not needed on first paint |
| 3 | **`NgOptimizedImage` + `priority` on LCP image** | High LCP win on image-heavy pages | Low | Hero images, galleries, listings, media |
| 4 | **OnPush + signals** | Med–High — fewer CD cycles, smoother INP | Med | Apps with large trees, frequent updates, big lists |
| 5 | **SSR + hydration (+ incremental hydration)** | High for LCP/FCP + SEO | Med–High | Content/marketing/e-commerce; less for auth-walled dashboards |
| 6 | **Zoneless change detection** | Med — removes zone.js, fewer needless cycles | Med (after OnPush+signals) | New apps; existing apps only after library compatibility check |
| 7 | **Preloading strategy for lazy routes** | Med — faster subsequent navigation | Low | After lazy loading; `quicklink`/custom over `PreloadAllModules` for big apps |
| 8 | **Fix template function calls / heavy getters** | Med — removes per-CD-cycle work | Low | Any template calling functions/getters in bindings or `@for` |
| 9 | **Service worker / caching (PWA)** | Med for repeat visits | Med | Installable/offline-friendly apps |

Guidance: do #1–#3 on nearly every app; they are cheap and high-impact. #4–#6 are the deeper structural investments. #5 is high-impact but only where server rendering makes sense.

### 3. Most overlooked pitfalls / common mistakes
- **Missing/incorrect `track` in `@for`** — without a stable key Angular destroys+recreates DOM on every change; tracking a value that changes each fetch is as bad as none. (The new `@for` at least *requires* `track`, unlike old `*ngFor` `trackBy`.)
- **Function/method calls and heavy getters in templates** — they re-run on **every change detection cycle** (potentially thousands of times/sec across a list). `@angular-eslint/template/no-call-expression` flags this. Fix with `computed()` signals, pure pipes, or precomputed properties. Note getters have the *same* problem as methods — switching method→getter does not fix it.
- **Barrel files (`index.ts`) breaking lazy loading / tree-shaking** — a common, silent Nx pitfall where importing from a barrel pulls in siblings and defeats code-splitting; import from concrete paths.
- **Importing whole libraries** (e.g. all of lodash, moment, an entire icon set) instead of tree-shakable deep imports; CommonJS deps that block minifier optimization.
- **Memory leaks from unmanaged subscriptions** — prefer `async` pipe / `toSignal()`; else `takeUntilDestroyed()`.
- **Zone pollution from third-party libs** — libraries using `setTimeout`/`setInterval`/websockets trigger needless CD under zone.js; run them outside Angular (`NgZone.runOutsideAngular`) or move to zoneless. In zoneless mode, libs that mutate component state in their own callbacks (charts, maps, drag-drop) won't trigger re-render — surface state via signals.
- **Oversized images without `NgOptimizedImage`** and not marking the LCP image `priority` (Angular emits a dev-mode warning when the LCP element is an image missing `priority`).
- **Eager loading of heavy routes**; ignoring bundle budgets in `angular.json` (or setting them to absurd values to hide the problem).
- **Hydration mismatches** — third-party scripts / ad/analytics that mutate the DOM before hydration cause errors; defer them with `afterNextRender`. Direct DOM manipulation and invalid HTML nesting also break hydration.
- **`@defer` above the fold without incremental hydration** — renders `@placeholder` on the server then swaps, causing CLS; nested `@defer` blocks with the **same** trigger cause cascading simultaneous requests.
- **Third-party scripts and font loading** — render-blocking fonts/CSS and heavy 3P JS hurt LCP/INP; self-host/`font-display: swap`/preload critical fonts.

### 4. Loading speed & perceived performance → Core Web Vitals mapping
Thresholds (all assessed at the **75th percentile** of real page views, per Google Search Central / web.dev):
- **LCP — good ≤ 2.5s:** `NgOptimizedImage` with `priority` (sets `fetchpriority=high`, `loading=eager`, and — under SSR — auto-emits a `<link rel=preload>`); SSR/SSG so the hero renders in server HTML; preconnect to image CDN; keep zone.js out to shave initial JS; avoid deferring in-viewport content.
- **INP — good ≤ 200ms** (INP replaced First Input Delay as the official responsiveness Core Web Vital on **March 12, 2024**): break up long tasks on the main thread; OnPush + signals + zoneless reduce needless CD during interactions; move heavy work off the click handler / into web workers; the `web-vitals` library's attribution build (`onINP`) pinpoints the slow interaction.
- **CLS — good ≤ 0.1:** always set image `width`/`height` (NgOptimizedImage enforces this); reserve space for deferred/async content; use incremental hydration so above-the-fold `@defer` blocks render without layout shift; size skeletons/placeholders to match final content.
- **`@defer` triggers:** `on idle` (default), `on viewport`, `on interaction`, `on hover`, `on immediate`, `on timer(...)`, plus custom `when`. **Prefetch** separately (`prefetch on idle`, `prefetch when ...`) to fetch JS before display. Hydration triggers (`hydrate on viewport/interaction/idle`, `hydrate never`) apply the same lazy patterns to SSR'd content.
- **Preloading strategies:** `PreloadAllModules` for small apps; for large apps use `ngx-quicklink` (`QuicklinkStrategy`, IntersectionObserver-based, respects data-saver/slow connections) or a custom `PreloadingStrategy` gated on `route.data.preload`.
- **Skeletons/placeholders:** use `@placeholder`/`@loading` blocks (with `minimum`/`after` to avoid flicker).
- **SSR/SSG/hybrid:** per-route `RenderMode.Client | Server | Prerender` via `provideServerRendering(withRoutes(serverRoutes))`; enable hydration with `provideClientHydration()`; incremental hydration is enabled by default when using `provideClientHydration()` with hydrate triggers.
- **Service worker/caching:** Angular service worker (`@angular/pwa`) for repeat-visit and offline caching where relevant.

### 5. Debugging & measuring
- **Angular DevTools** (browser extension) — profiler visualizes change-detection cycles, component render timings, and the injector tree; the officially recommended tool for spotting CD problems.
- **Angular + Chrome DevTools performance panel** — Angular integrates with the Chrome DevTools extensibility API to show framework-specific data directly in the performance panel; use "timespan" mode / record interactions to debug INP.
- **Lighthouse** — lab CWV + opportunities; run before/after on a single route.
- **Bundle analysis:** `ng build --stats-json` produces an esbuild **metafile** (`stats.json`) → upload to the esbuild Bundle Size Analyzer (esbuild.github.io/analyze). Or `source-map-explorer` (needs `sourceMap: true`, `namedChunks: true`, `outputHashing: none`). Note: since the v17 esbuild switch, webpack-bundle-analyzer no longer applies; `stats.json` is an esbuild metafile, not the old webpack stats format.
- **Bundle budgets** in `angular.json` (`budgets` array): `type: initial` / `bundle` / `anyComponentStyle`, with `maximumWarning`/`maximumError` and optional `baseline` + percentage thresholds; build warns/errors when exceeded.
- **Web Vitals RUM:** the `web-vitals` npm library (`onLCP`/`onINP`/`onCLS`, attribution build) to log field data; feed to analytics/RUM.
- **Memory leaks:** Chrome DevTools Memory panel heap snapshots; watch for retained detached components from un-torn-down subscriptions.

### 6. Automating performance analysis (AI-runnable audit workflow)
- **Bundle budgets as a gate:** `ng build --configuration production` fails CI when budgets are exceeded (set `maximumError`).
- **Bundle diff:** `ng build --stats-json`; analyze `stats.json` (esbuild metafile) in a pipeline for size regressions.
- **Lighthouse CI (`@lhci/cli`):** `npm i -g @lhci/cli` then `lhci autorun` (collects 3 runs, takes median, asserts against budgets in `lighthouserc.json` / `budget.json`). Assertions like `'categories:performance': ['error', {minScore: 0.9}]` and per-metric `largest-contentful-paint: ['error', {maxNumericValue: 2500}]`. Set thresholds slightly above current scores to catch regressions, not fail every build; runner variance is real (desktop preset reduces mobile-throttling noise). Note LHCI 0.15.x uses Lighthouse 12.6.1; PWA category was removed in Lighthouse 12.
- **Lint gates:** `angular-eslint` — `@angular-eslint/template/no-call-expression` (no function calls in templates), `@angular-eslint/prefer-signals` (enforce `input()`/`viewChild()`/`contentChild()` + `readonly` signals). Run `ng lint` in CI.
- **Playwright/Puppeteer** performance traces for user-journey timings and INP under real interactions.
- **Suggested AI-agent audit workflow (step by step):**
  1. Detect Angular version (`ng version` / `package.json`) → load the matching fingerprint rules.
  2. `ng build --configuration production` → capture budget warnings/errors + per-chunk sizes.
  3. `ng build --stats-json` → parse `stats.json`, list largest modules, flag whole-library imports and CommonJS deps.
  4. Grep for anti-patterns: `*ngIf`/`*ngFor` (should be `@if`/`@for`), `@for` without `track`, function calls in templates, missing `NgOptimizedImage`/`priority`, barrel-file imports, manual `.subscribe()` without teardown.
  5. Check config: bundle budgets present & sane; hydration/`provideClientHydration()`; render modes; preloading strategy.
  6. Run `ng lint` with the perf rules; run Lighthouse (or LHCI) on key routes; capture LCP/INP/CLS + performance score.
  7. Produce a ranked report using the bang-for-buck table; propose diffs; re-run build+Lighthouse to verify.

### 7. Version fingerprinting / provenance scheme
**Repo convention (verified):** the user's repo keeps `SKILL.md` frontmatter minimal and documents provenance in a **separate per-skill `README.md`** — the root README explicitly says of `jookoi-fastled`: "See its README for provenance." The repo uses one broad plugin (`jookoi-dev`) with each skill as a folder under `plugins/jookoi-dev/skills/<name>/`, and defers versioning until a capability "needs independent distribution, versioning, or audience."

**Frontmatter compatibility facts:** The Agent Skills open standard defines only `name`, `description`, `license`, `compatibility`, `metadata`, and `allowed-tools`; everything else is a Claude Code extension. Only `name` and `description` are load-bearing/required (`name` kebab-case, must match the folder). Custom top-level frontmatter fields are **stripped before the body is shown to the model** in Claude Code (they won't error, but they also won't be read by the model) — so version/provenance data belongs either in the body/README or under the spec-allowed `metadata:` object, not as invented top-level keys. `name` and `description` must be valid YAML (quote descriptions containing colons).

**Recommended fingerprint scheme (matches repo + spec):**
- Keep `SKILL.md` frontmatter to `name` + `description` only (portable across Claude/Gemini/Codex/Cursor).
- Put the fingerprint in a sibling `README.md` (and optionally mirror it as a human-readable block at the top of the SKILL body), e.g.:
  ```
  Angular performance skill — provenance
  angular_version_baseline: 22.x (stable, released 2026-06-03)
  verified_on: 2026-09-21
  last_reviewed: 2026-09-21
  release_cadence_note: v22 begins 12-month major cadence; next major v23 targeted June 2027; support 24 months
  sources:
    - https://angular.dev/best-practices/runtime-performance
    - https://angular.dev/guide/zoneless
    - https://angular.dev/best-practices/performance/image-optimization
    - https://angular.dev/guide/incremental-hydration
    - https://angular.dev/guide/ssr
    - https://angular.dev/reference/releases
  what_changes_per_major (refresh checklist):
    - zoneless provider name/stability
    - default change-detection strategy
    - Signal Forms stability
    - SSR render-mode / provider API
    - @defer hydrate trigger set
    - NgOptimizedImage behavior
    - release cadence / support window
  ```
- Include a tiny refresh instruction/script the agent can run: compare `angular_version_baseline` to the installed version (`ng version` or `node -p "require('@angular/core/package.json').version"`) and to the latest npm (`npm view @angular/core version`); if the installed/latest **major** exceeds the baseline, print a "skill may be stale — re-review the what_changes_per_major checklist" warning.

---

## Details

### Recommended skill file/folder structure
Match the repo's one-plugin, per-skill-folder layout. Create the new skill under `plugins/jookoi-dev/skills/` (the task calls it a separate "angular" section — a folder named e.g. `jookoi-angular-performance` keeps the author's `jookoi-` prefix):

```
plugins/jookoi-dev/skills/jookoi-angular-performance/
├── SKILL.md                      # lean: frontmatter (name+description) + overview, quick-start audit, links to references
├── README.md                     # provenance/fingerprint (version baseline, verified_on, sources, refresh checklist)
└── references/
    ├── change-detection.md       # signals, OnPush, zoneless, zone pollution
    ├── loading-and-cwv.md        # lazy routes, @defer, preloading, images, fonts, SSR/hydration, CWV mapping
    ├── pitfalls.md               # the overlooked-mistakes checklist
    ├── measuring.md              # DevTools, Lighthouse, bundle analysis, web-vitals RUM
    ├── automation.md             # budgets, LHCI, eslint, Playwright, the CLI audit workflow
    └── version-notes.md          # per-major changes + version-sensitive APIs
```
This uses progressive disclosure: metadata (name+description) loads at startup; the SKILL body (keep under ~5k tokens) loads on activation; reference files load only when the relevant sub-task comes up. Note the repo's documented structure shows skills containing a `SKILL.md` (and `jookoi-fastled` additionally a `README.md`); `references/` subfolders are a standard Agent Skills convention and are compatible even though the repo hasn't used them yet.

The official Angular team now ships its own agent skills (`angular-developer`, `angular-new-app`) at `github.com/angular/skills` (installable via `npx skills add https://github.com/angular/skills`), which are general-purpose code-generation skills, not performance-focused. The new skill should complement, not duplicate them — cross-reference them and focus specifically on performance auditing/optimization.

### Trade-offs & conflicts to flag in the skill
- **Zoneless:** big conceptual win and smaller bundle, but requires OnPush+signals discipline and library compatibility; migrate existing apps last (order: library check → OnPush everywhere → signals → enable zoneless → remove zone.js). Some 2026 practitioner posts still reference the old `provideExperimentalZonelessChangeDetection` name — flag that the stable name is `provideZonelessChangeDetection` (stable since 20.2, default in 21+).
- **Signal Forms:** stable in v22 but still new; keep Reactive Forms for large/dynamic/highly-conditional enterprise forms and third-party `ControlValueAccessor` integrations.
- **SSR:** improves LCP/SEO but adds server/infra complexity and hydration pitfalls; not worth it for auth-walled dashboards.
- **`PreloadAllModules`:** simple but can flood the network and cause main-thread route registration cost on large apps — prefer quicklink/custom.
- **Template functions:** Angular *must* re-run them each CD cycle; there is no perfect fix except moving computation to signals/pipes/precomputed state (one practitioner argues functions are "fine" in stateless OnPush display components, but this is the minority view — the safe default is to avoid them).
- **Lighthouse in CI** is lab data with real run-to-run variance; treat green LHCI as necessary-but-not-sufficient and confirm with field/RUM data.

---

## Recommendations
1. **Write the skill against Angular 22**, with a clearly fingerprinted baseline (`angular_version_baseline: 22.x`, `verified_on: 2026-09-21`) in a sibling `README.md`, and a "what changes per major" refresh checklist. Keep `SKILL.md` frontmatter to `name` + `description` only for cross-harness portability.
2. **Lead the SKILL body with the ranked bang-for-buck table and the step-by-step CLI audit workflow** — that is the part an AI agent will actually execute. Put deep dives in `references/`.
3. **Bake in the automation gates:** production build with real bundle budgets, `--stats-json` analysis, Lighthouse CI with per-metric assertions, and the `angular-eslint` perf rules. Give exact commands and expected outputs.
4. **Make version-sensitivity explicit** everywhere an API moved (zoneless provider, Signal Forms, SSR providers, default CD strategy) so the fingerprint can flag staleness — note that under the new 12-month cadence the next trigger point (v23) is targeted for **June 2027**, giving the skill a longer valid window than the old 6-month rhythm implied.
5. **Cross-reference the official `angular/skills`** so the skill composes with them rather than fighting them.

**Benchmarks that change the recommendations:**
- If a new Angular major ships (v23, targeted June 2027) → run the refresh checklist; re-verify zoneless/Signal-Forms/SSR API names and the default CD strategy.
- If LCP > 2.5s → prioritize `NgOptimizedImage` `priority` + SSR/preload before touching change detection.
- If INP > 200ms → prioritize OnPush/signals/zoneless + long-task breakup + `@defer`, not images.
- If initial bundle exceeds budget → lazy-load routes, `@defer` heavy deps, and hunt whole-library/barrel imports before anything else.
- If the team still runs zone.js and third-party libs break under zoneless → keep zone.js, do OnPush + `runOutsideAngular` instead.

## Caveats
- **Repo file contents partially unverified:** I confirmed the repo's overall structure, the one-plugin layout, and that `jookoi-fastled` documents provenance in a separate `README.md`, but the exact verbatim frontmatter of the existing `SKILL.md` files and the exact provenance-section wording could not be fetched (brand-new, unindexed public repo). Before finalizing, open `plugins/jookoi-dev/skills/jookoi-fastled/README.md` and one `SKILL.md` directly to copy the author's exact frontmatter fields and provenance phrasing.
- **Bundle-size deltas for zoneless** are practitioner figures, not an official Angular benchmark: zone.js v0.14 is ~33 KB raw / ~10 KB gzip (PkgPulse, SharpSkill), with one developer citing ~13 KB gzip — present as "roughly 10–13 KB gzip."
- **Release cadence is mid-transition:** the 12-month cadence, June-2027 v23 target, and 24-month support are drawn from angular.dev/reference/releases plus angular.love and daily.dev summaries; re-verify against angular.dev when shipping, as roadmap dates can shift.
- **Some secondary sources are Medium/DEV posts;** all core claims (defaults, API names, CWV techniques) are corroborated by angular.dev and web.dev, which should be the skill's cited authorities.
- **Lighthouse/LHCI version specifics** (Lighthouse 12.6.1, Node requirements) drift quickly — treat as "check current" in the skill.
- The **default-change-detection rename** (`Default` → `Eager`) in v22 and **selectorless components** are recent; verify exact naming against angular.dev before asserting in the shipped skill.

---

### Source list (with dates/versions where visible)
- angular.dev — Performance Overview / Runtime performance (served at v22.1.7, 2026)
- angular.dev — Zoneless guide; Hydration & Incremental Hydration guides; SSR/hybrid-rendering guide; Image optimization / NgOptimizedImage; Deferred loading with @defer; Building Angular apps (budgets); Agent Skills; LLM prompts & AI IDE setup; reference/releases (cadence & support policy)
- blog.angular.dev — "Announcing Angular v22" (Jun 2026)
- Wikipedia "Angular (web framework)" — version table (Angular 22, 3 June 2026; v21 Nov 2025; v20 May 2025; v19 Nov 2024; v18 May 2024)
- code.claude.com/docs — Skills (frontmatter fields, standard vs extensions); platform.claude.com — Agent Skills overview & best practices; agentpatterns.ai, agensi.io, agentman.ai — SKILL.md frontmatter references; anthropics/claude-code issue #13005 (custom frontmatter stripped)
- github.com/equilerex/jookoi-ai-market — README (repo structure, one-plugin layout, "See its README for provenance", versioning-deferral stance)
- github.com/angular-eslint/angular-eslint — no-call-expression and prefer-signals rule docs
- web.dev / Google Search Central — Core Web Vitals thresholds (LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at 75th pct); "Optimize INP"; INP replaced FID March 12, 2024; route-preloading-in-angular
- web.dev + esbuild.github.io/analyze; amadousall.com, angular.love, dev.to — bundle analysis (stats.json / source-map-explorer)
- unlighthouse.dev, qaskills.sh — Lighthouse CI (@lhci/cli 0.15.x / Lighthouse 12.6.1) config & budgets
- Telerik, web.dev, ngx-quicklink docs — preloading strategies
- angular.love, angularexperts.io, procedure.tech, Lunatech — zoneless / change-detection migration guidance
- PkgPulse, SharpSkill, aelm.dev — zone.js bundle-size figures
- angular.love, daily.dev — Angular release-cadence change (12-month cadence, v23 June 2027, 24-month support)
- dev.to (Brandon Roberts), InfoQ, angular.love — official Angular agent skills (angular-developer / angular-new-app)