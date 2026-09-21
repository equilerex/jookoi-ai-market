# jookoi-angular-performance

An LLM skill for auditing and fixing performance in existing Angular apps.

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
- `stats.json` format and budget types
- `angular-eslint` rule names

Then update `references/version-notes.md`, this table, and `BASELINE_MAJOR`.

## What's in it

| File | Covers |
|---|---|
| `SKILL.md` | Audit workflow, symptom → fix table, ranked fixes, pitfalls a regex can't see |
| `scripts/audit.mjs` | Zero-dependency static audit: budgets, builder, zone mode, templates, images, lazy routes, heavy imports, SSR wiring, staleness |
| `references/change-detection.md` | OnPush, signals, zoneless migration order, zone pollution, template cost, INP |
| `references/loading.md` | Lazy routes, `@defer`, preloading, images, fonts, SSR/hydration, CWV |
| `references/measuring.md` | DevTools, bundle analysis, budgets, Lighthouse CI, lint gates |
| `references/version-notes.md` | Per-major changes v15-v22 and APIs to double-check |

## What it isn't

Not a general Angular guide. Code conventions, new features, and scaffolding belong to the official `angular-developer` and `angular-new-app` skills (`npx skills add https://github.com/angular/skills`). This one only deals with speed.

## License

UNLICENSED. Personal toolkit, shared in case it's useful.
