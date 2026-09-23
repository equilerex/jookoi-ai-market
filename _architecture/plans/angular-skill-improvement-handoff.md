# Handoff: improve the jookoi-angular-performance skill from a real run

Start a fresh session in `D:\repos\Serenity\jookoi-ai-market` and paste the prompt at the bottom.

## Context

The skill was validated on a real repo (`D:\repos\Serenity\JooKoi-frontpage-to-the-open-web`, Angular 22) and drove a full performance pass. It passed the old-flaw checks (no proactive OnPush or zoneless advice, no edits before the user picked, no unprompted builds or installs) but had content gaps and one behaviour failure that produced wrong advice.

Skill working copy: `plugins/jookoi-dev/skills/jookoi-angular-performance/` (`SKILL.md`, `references/*.md`, `scripts/audit.mjs`, `README.md`).

Evidence and proposed edits, in priority order, are in `_architecture/plans/angular-skill-improvement-brief.md`. The pass/fail table from the validation is in `_architecture/plans/angular-skill-validation-report.md` (read the brief first; the report has one correction noted at its top).

## What to do

Apply the brief. In order:

1. `SKILL.md`: add the "open the reference before naming an API, quote its version line" rule and a short block of v22 traps near the top. Add the package-manager check before any install.
2. `references/chunk-size.md` and `references/build-and-deploy.md`: budget sizing section (raw versus transferred, reference numbers with sources and dates, first-budget derivation rule, `anyScript` for lazy chunks, `anyComponentStyle` recommendation, how to propose a number to the user), the `stats.json` facts, the failed-build-writes-nothing note.
3. `scripts/`: add a per-route cost script (reads `stats.json`, prints each route chunk plus its non-initial static-import closure) and a per-package breakdown of a chunk. Both were rewritten by hand three times in the run.
4. `scripts/audit.mjs`: fix the `track` false positive (primitive items are correct) and add the two leads (eager `component:` routes with heavy import closures, single source files over N kB in `main`).
5. `references/chunk-size.md`: the "wrapper around a heavy UI-kit component" pattern with plain-markup and `@defer (hydrate ...)` options and their tradeoff.
6. `references/loading.md` and `references/ssr.md`: the above-the-fold check in the running browser, the prerendered-static `@defer` CLS note, degradation of a not-yet-hydrated table, and the parameterised-redirect-plus-`**` prerender failure.
7. `references/measurement-automation.md`: the default setup (pinned repo-local `lighthouse`, median of 3, committed per-commit JSON, compare command, targets versus regression failures) and the traps (preview server must serve prerendered HTML with compression, Windows Lighthouse `EPERM`, runner mismatch, dirty baselines, single-run noise).
8. `README.md`: note what changed and the date.

## Rules

- Read the references before editing them. Do not answer from memory about Angular APIs: check `references/ssr.md` and the project's installed Angular version. (The last session got `withIncrementalHydration()` wrong on v22 by not doing this.)
- Any number quoted as a standard (for example a compressed-size guideline) needs a source and date, or must go in the reference's "Unverified" list. Prefer 2025+ sources.
- Write scripts and reference files with the file-writing tools, not shell heredocs (this harness mangles doubled backslashes).
- Keep references short. The last session loaded only `chunk-size.md` and `build-and-deploy.md` and that was enough, so put the most-needed content in those two.
- Do not run installs or builds on the JooKoi repo. To validate the new scripts, run them read-only against `D:\repos\Serenity\JooKoi-frontpage-to-the-open-web\dist\jookoi-frontpage\stats.json` (already built) and check that they reproduce: home 25 kB, search 255 kB, library 212 kB route cost; initial 536 kB raw.
- Do not commit or push.

## Done when

- `SKILL.md` and the references contain every item in the brief, or the brief entry is marked as declined with a reason.
- The new scripts run on the JooKoi `stats.json` and reproduce the numbers above.
- `audit.mjs` on the JooKoi repo no longer reports the `track` false positive.
- The skill's `README.md` records the change.

## Prompt to paste in the new session

```
Improve the jookoi-angular-performance skill using the run evidence.
Follow the handoff at D:\repos\Serenity\jookoi-ai-market\_architecture\plans\angular-skill-improvement-handoff.md
and apply the brief at D:\repos\Serenity\jookoi-ai-market\_architecture\plans\angular-skill-improvement-brief.md.
Read the references before editing them. Edit only the skill's working copy under plugins\jookoi-dev\skills\jookoi-angular-performance\.
Do not run builds or installs on the JooKoi repo, and do not commit.
```
