# Handoff: validate the jookoi-angular-performance skill on a real repo

Start a fresh session in `D:\repos\Serenity\JooKoi-frontpage-to-the-open-web` and paste the prompt at the bottom.

## Context

The skill was reworked from a "fix it now" auditor into an advisor plus a read-only auditor. The first version, run earlier on the target repo, showed flaws: it proactively added OnPush and other things that are already defaults on the project's Angular version.

Working copy of the skill (this is what to test):
`D:\repos\Serenity\jookoi-ai-market\plugins\jookoi-dev\skills\jookoi-angular-performance\`

The installed `jookoi-dev` plugin may be a cached copy of the OLD skill. Do not rely on the Skill tool for this test. Read `SKILL.md` from the path above, then load references from the same folder as needed.

What changed (the things to verify actually hold):
- Detect actual state, not only the version. Skip what the project already has by default. Report legacy leftovers, do not change them.
- Audit is read-only. Edits only for items the user picks. Behavior-changing migrations confirmed one by one.
- Never install tools, add CI jobs, or schedule runs unprompted.
- New topic references (chunk-size, ssr, data-loading, assets-and-third-parties, runtime, build-and-deploy, measurement-automation, docs-map, preloading) with an "Unverified, check before relying" list at the end of each.
- `audit.mjs` findings are all leads, most at `info` on new majors.

## Protocol

1. Read the skill from the working-copy path. Detect the project's Angular version and actual state (zone.js polyfill, app config, `angular.json`).
2. Run `node <skill>/scripts/audit.mjs D:\repos\Serenity\JooKoi-frontpage-to-the-open-web` (read-only).
3. Act as the skill says: group findings by size and risk, pick the relevant topic references, present options. Do NOT edit the target repo. Do NOT commit or push.
4. Write a validation report (below).

## What to check and record

Flaws from the first version (should be gone):
- [ ] Recommends OnPush, zoneless, `provideZonelessChangeDetection`, `standalone: true` or control-flow migration where the project already has the default or already uses it?
- [ ] Changes code without the user picking items?
- [ ] Runs or proposes running builds, installs, CI setup or scheduling without asking?

New behavior (should hold):
- [ ] Leftovers on the project's major reported with `file:line` and cost/gain, unchanged.
- [ ] Recommendations match the project's real config (budgets, hashing, hydration, builder) and not quoted defaults.
- [ ] Unverified items from the references stated as unverified, not as fact.
- [ ] Preloading advice: keeps `NoPreloading` unless there is evidence, flags `PreloadAllModules` correctly.
- [ ] Measurement setup: asks the questions in `measurement-automation.md` before proposing anything.

Also record: wrong or stale facts noticed in the references (compare against the project's installed Angular version and `angular.json`), advice that felt too generic, anything in the skill that cost many tokens for little use.

## Optional, needs the user's approval first

The references leave one question open: whether lazy `import()` chunks appear as metafile entry points, which decides whether `bundle` budgets match them. If the target repo builds, one production build with `statsJson` enabled would settle it, plus the `browser-stats.json` name and location and the generated budget defaults. Ask before running the build.

## Report format

Write to `D:\repos\Serenity\jookoi-ai-market\_architecture\plans\angular-skill-validation-report.md`: findings table (item, expected, actual, pass/fail), list of concrete skill edits needed (file and line), and open questions. Keep it under 80 lines.

## Prompt to paste in the new session

```
Validate the jookoi-angular-performance skill on this repo. Follow the handoff at
D:\repos\Serenity\jookoi-ai-market\_architecture\plans\angular-skill-validation-handoff.md
Read the skill from its working-copy path, not the installed plugin. Read-only: no edits to this repo, no commits. Ask me before running any build.
```
