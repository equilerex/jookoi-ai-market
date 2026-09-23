# jookoi-angular-performance

An LLM skill that audits and fixes performance in existing Angular apps, and works as a knowledge base for the harder cases: planning bigger changes, choosing between options, setting up measurement, and finding the right docs.

## Why

Asked to "optimize" an Angular app, an LLM tends to sprinkle OnPush and `trackBy` everywhere and call it done, whatever the actual bottleneck is. It also recommends APIs by stale names (`provideExperimentalZonelessChangeDetection`) or ones the project's version doesn't have. This skill makes it measure first, pick fixes by symptom, and check the version before naming an API.

## Provenance

| Field | Value |
|---|---|
| Angular baseline | 22.x (released 2026-06-03) |
| Verified on | 2026-09-21 |
| Research | `_architecture/plans/angular-optimize-skill-research.md` in this repo, reviewed and corrected before writing the skill |
| Cross-checked against | angular.dev (via Context7), the official `angular-developer` skill |

Primary sources: angular.dev pages on runtime performance, skipping subtrees, zoneless, `@defer`, incremental hydration, SSR/hybrid rendering, image optimization, build budgets, and the release policy. web.dev for Core Web Vitals thresholds. Zone.js size figures are practitioner measurements, not an Angular benchmark.

`scripts/audit.mjs` carries `BASELINE_MAJOR = 22` and warns when a project (or, with `--latest`, npm) is on a newer major.

## Refresh checklist (new Angular major)

Angular moved to a 12-month major cadence at v22, so v23 is expected around mid-2027. When it ships, re-verify:

- zoneless provider name and default
- default change-detection strategy and the opt-out name
- SSR render-mode and provider API
- `@defer` and hydrate trigger set, incremental hydration default
- `NgOptimizedImage` behavior and loaders
- animations package status
- stats metafile name and budget types and defaults
- `angular-eslint` rule names

Then update `references/version-notes.md`, this table, and `BASELINE_MAJOR`.

## What's in it

| File | Covers |
|---|---|
| `SKILL.md` | Working rules, request routing, quick audit/fix workflow, symptom table, ranked quick fixes, pitfalls |
| `scripts/audit.mjs` | Zero-dependency static audit, read-only |
| `scripts/route-cost.mjs` | Per-route cost of lazy chunks from `stats.json`, read-only |
| `scripts/chunk-packages.mjs` | Per-package breakdown of a chunk or the initial set, read-only |
| `references/chunk-size.md` | Bundle and lazy-chunk size |
| `references/loading.md` | Lazy routes, `@defer`, CWV mapping |
| `references/preloading.md` | Router preloading and strategies |
| `references/assets-and-third-parties.md` | Images, fonts, CSS, third-party scripts |
| `references/change-detection.md` | OnPush, signals, zoneless |
| `references/runtime.md` | Profiling, INP, RxJS, forms, lists, memory |
| `references/data-loading.md` | Waterfalls, resolvers, resources, transfer cache |
| `references/ssr.md` | SSR, hydration, when not to use it |
| `references/build-and-deploy.md` | Builder options, defaults, caching, service worker, CI gates |
| `references/measuring.md` | Manual measuring |
| `references/measurement-automation.md` | Repeatable measurement, baselines, comparison |
| `references/docs-map.md` | Canonical docs, dead URLs |
| `references/version-notes.md` | Per-major changes |

Research behind the references: `_architecture/plans/angular-*-research.md` and `angular-gap-fill-*.md`. Claims are tagged verified or unverified there, and each reference ends with its unverified list.

## Changelog

- 2026-09-22: first real-run feedback (`_architecture/plans/angular-skill-improvement-brief.md`). `SKILL.md`: open-the-reference rule, v22 traps, package-manager check before installs, landing route and shell as a ranked fix. `chunk-size.md`: route cost, eager imports, UI-kit wrapper pattern, budget sizing (raw vs transferred, derivation rule, `anyScript`, `anyComponentStyle`). `build-and-deploy.md`: `stats.json` facts, failed builds write nothing. `loading.md` and `ssr.md`: above-the-fold check, prerendered `@defer`, redirect plus `**` failure. `measurement-automation.md`: default setup and traps. New `route-cost.mjs` and `chunk-packages.mjs`. `audit.mjs`: `track item` downgraded to info, leads for eager `component:` routes and large source files in initial entries. Not tested: `bundle` and `anyScript` budgets on lazy chunks in v22 (see the unverified lists).

## What it isn't

Not a general Angular guide. It does not install tools or change code without being asked. Code conventions, new features, and scaffolding belong to the official `angular-developer` and `angular-new-app` skills (`npx skills add https://github.com/angular/skills`). This one only deals with speed.

## License

UNLICENSED. Personal toolkit, shared in case it's useful.
