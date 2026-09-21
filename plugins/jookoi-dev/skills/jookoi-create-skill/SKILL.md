---
name: jookoi-create-skill
description: Create or adapt a personal, cross-harness agent skill when a reusable workflow belongs in .agents/skills, especially when preserving an existing skill while removing host-specific assumptions.
license: Apache-2.0
---

# Personal skill creator

<!-- Modified 2026-09-19 from the Apache-licensed skill-creator: retained its draft, test, review, and iteration workflow; replaced host-bound instructions with portable ones. -->

Build a skill for a demonstrated need. Start from the user's actual workflow and keep the result small enough that another agent will read it and act correctly. A `SKILL.md` is the portable core. Other files are optional support.

## Personal defaults

- For a project skill, write `<repo>/.agents/skills/<name>/SKILL.md`. For a personal skill used across projects, write `~/.agents/skills/<name>/SKILL.md`. In this developer-stack repo, `my-global-setup/.agents/skills/` is the tracked copy of selected personal skills; copy a finished skill to the real global folder deliberately.
- Use plain Markdown and YAML. Do not require a new binary, package, service, agent CLI, or model for the skill's normal operation. Add scripts only for repeated mechanical work that earns them.
- Keep the common instructions independent of any one coding agent. Put host-specific metadata or invocation controls in optional files for the hosts that need them. Check a host's actual discovery and invocation behavior before claiming support for it.
- Preserve existing user files and repo conventions. Make targeted edits; do not replace a skill wholesale for a small change. The user makes all git commits.

## 1. Capture the job

Read the request and any existing skill first. Extract five things: when it should run, what input it receives, what action it takes, what it produces, and where it must stop. Use examples from the user's real workflow. Ask about a missing choice only when the answer changes the design. If the user wants an adaptation of an existing skill, copy its full package first, then track which parts are portable, which need an optional host adapter, and which are obsolete.

Check for overlap with nearby skills. A narrow, clear boundary in the description is more useful than a broad promise to handle everything. Keep the source of truth explicit when the skill has both a tracked copy and an installed copy.

## 2. Write the skill

Every skill needs a folder named for its skill and a `SKILL.md` with YAML frontmatter:

```markdown
---
name: example-skill
description: Use when a specific recurring task needs this workflow.
---

# Example skill

Instructions that let the agent perform the task.
```

The description is for selection: say when the skill applies and where its boundary is. Put steps, examples, and edge cases in the body. Use concrete verbs and the user's own terminology. Explain a constraint when its reason affects judgment. Cut repeated background and generic advice.

Keep `SKILL.md` usable on its own. Put long or rarely needed material in `references/`, reusable mechanical helpers in `scripts/`, and output templates in `assets/`. Link each resource at the point where it becomes useful. Do not create empty scaffolding or require every resource to load on every invocation.

When a host needs extra metadata, add it as an optional adapter without making the portable core depend on it. A host's slash command, skill picker, implicit triggering, and policy files are separate behaviors; verify each one you promise. Do not force a host-only frontmatter key into the shared file if another host rejects it.

## 3. Verify the draft

By default, create the skill to the best of your ability, validate its frontmatter and referenced paths, and inspect its instructions against the user's example. Do not run prompt suites, baselines, grading, or benchmarks unless the user explicitly requests them. For a complex or frequently used skill, you may suggest benchmarking after delivering the usable skill; the suggestion must not delay delivery.

## Optional benchmarking

Run this only when the user asks to benchmark or optimize a skill. Use several realistic cases, including an edge case and a negative trigger case. Run cases in an isolated workspace when they could write files. For a comparison, run the same cases with and without the skill when the active harness supports independent runs. Record the prompt, observed action, final artifact, and unexpected side effects. If independent runs are unavailable, test sequentially and say so; do not present that as a controlled comparison.

Use `agents/grader.md` and `agents/analyzer.md` when grading is useful; `references/schemas.md` describes the optional result format. For a human review pass, `eval-viewer/generate_review.py <workspace> --static <output.html>` produces a standalone page. `scripts/aggregate_benchmark.py <workspace> --skill-name <name>` summarizes structured grading results. These tools do not run by default.

## 4. Revise and deliver

Review actual failures before editing. Fix the smallest cause: a missed trigger, an unclear boundary, a missing step, a bad example, or a helper that does not work. Re-run only the cases affected by that change. Do not grow the skill to cover hypothetical cases.

For existing skills, preserve useful behavior and bundled resources while removing stale assumptions. If a feature cannot be made portable without building a new integration, say which feature is host-bound and keep the rest of the skill usable. Preserve license and attribution files when adapting a licensed package; mark modified files as required by that license.

Validate the finished folder with `scripts/quick_validate.py <skill-folder>` when Python and its dependencies are available, or an available host validator. Check links and run bundled scripts only when their behavior matters to the requested skill. Package with `scripts/package_skill.py <skill-folder>` only when the user needs a distributable archive.

Report the source location, installed location if different, what changed from the source, what was tested, and any unverified host behavior. Do not commit, publish, or install outside the requested scope.
## Personal defaults and verification

- Write project skills to `<repo>/.agents/skills/<name>/SKILL.md`. Write personal skills to the host's configured global skill directory; on this computer that is `C:\Users\Joosep\.agents\skills\<name>\SKILL.md`. The tracked copy in this repository is `my-global-setup/.agents/skills/`; copy it deliberately when installing or updating the personal skill.
- Resolve the actual repository root before editing. Edit the canonical file directly on the user's machine unless isolation was requested; never silently substitute a temporary workspace.
- Keep `SKILL.md` portable across harnesses. Put host-specific metadata or invocation behavior in optional adapter files such as `agents/openai.yaml`; check the target host's discovery rules before adding one.
- Default verification is lightweight: validate frontmatter and `name`/`description`, check every referenced local path, run `scripts/quick_validate.py` when bundled, and read the skill against one realistic trigger and one nearby non-trigger. Do not run prompt suites, grading, or benchmarks unless explicitly requested.

Benchmarking is an explicit mode, never the default. The bundled benchmark scripts, evaluator guidance, and viewer are optional support and should not be loaded in normal creation mode. If benchmarking is requested, include realistic edge and negative cases, isolate the runs from production files, record prompts/actions/artifacts/side effects, and state limits on any comparison. The viewer may use external browser assets, so invoke it only for an explicitly requested evaluation workflow.
## Personal skill installation topology

When creating or updating a personal skill, use the discovered shared skill source as the canonical source whenever one is configured. Resolve it from the current machine rather than assuming a username, drive letter, or folder layout:

- Search the user's global instructions and the target repository instructions first for a declared shared skill source. Only then search configured plugin or marketplace roots for a `plugins/<plugin>/skills/` directory.
- For this setup, the known examples are `D:\repos\Serenity\jookoi-ai-market\plugins\jookoi-dev\skills\` and `C:\BB\serenity\jookoi-ai-market\plugins\jookoi-dev\skills\`; these are examples, not portable defaults.

After writing the canonical `<source>\<name>\` directory, expose it through these targets when they exist or are part of the configured setup:

- `<user>/.agents/skills/<name>/` (the portable default global target)
- `<user>/.claude/skills/<name>/` (only when that host directory is present or configured)
- `<repo>/my-global-setup/.agents/skills/<name>/` (only when maintaining a tracked setup mirror)
- `<repo>/my-global-setup/.claude/skills/<name>/` (only when maintaining a tracked setup mirror)

Prefer directory symlinks to the canonical source. Windows symlink creation may require permission or developer-mode support; if linking fails, make a complete hard copy and report that fallback. Keep tracked setup copies self-contained when the repository's portability or Git workflow makes symlinks unsuitable. Never overwrite an existing skill silently: inspect it, preserve unrelated files, and report whether each target was linked or copied.

The canonical source path is configuration, not part of the skill's portable instructions. If no plugin repository is configured or discoverable, default to the user's global `.agents/skills/<name>/` directory. Add other targets only when they are discoverable and writable, and state which targets were linked or copied.
## Scope decision

Use these terms literally:

- **Target repository** is the repository the user is currently asking to modify.
- **Personal skill** is a skill intended for the user's global agent setup.
- **Shared skill source** is an optional repository or directory explicitly designated by the user's instructions as the canonical place to publish reusable skills. It may be called a marketplace, plugin repository, catalog, or something else. Do not assume that every user has one.

Classify the requested skill before choosing destinations:

- **Repository skill**: write to the target repository's `.agents/skills/<name>/`. Do not create global links or copies unless the user also requests personal installation. A repository that happens to support repository-level skills follows this rule.
- **Personal/global skill**: use the configured shared skill source when one exists; otherwise use the user's global `.agents/skills/<name>/` directory as the canonical source. Add optional host and tracked setup mirrors when configured.
- **Shared-source skill**: write to the explicitly configured shared skill source. If that source is also a repository the user is actively working in, its own `.agents/skills/` may be maintained as a deliberate mirror. Do not publish to an undiscovered or merely guessed marketplace.

If the user names a scope, follow it. If they do not, infer from the requested destination and wording; ask only when choosing the wrong scope would create unwanted global files or publish a private skill. Treat words such as “marketplace” or “plugin” as meaningful only when the user or local instructions identify the corresponding path.
For a personal skill, perform this source-and-target setup as part of the creation task; do not stop after writing `SKILL.md` in only one directory. Use `scripts/sync_personal_skill.py` for the marketplace copy and directory symlinks. Do not recreate that distribution workflow manually with ad hoc copy, move, or link commands. Run the script from the tracked `jookoi-create-skill` package. Report the resolved canonical source and the copy/link result for each target.
