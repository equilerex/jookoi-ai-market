---
name: jookoi-create-skill
description: Create, adapt, or validate a personal cross-harness Agent Skill (.agents/skills or plugin skills). Use when building a new skill, converting a workflow or existing skill into a portable SKILL.md package, or checking skill compliance against the Agent Skills specification.
license: Apache-2.0
metadata:
  last_updated: "2026-10-25T01:10:00Z"
  author: Joosep Kõivistik
  repository: https://github.com/equilerex/jookoi-ai-market
---

# Personal skill creator

<!-- Modified 2026-10-25 from the Apache-licensed skill-creator: aligned with the official Agent Skills specification and best practices; retained portable draft, validation, and optional benchmarking workflows. -->

Build or adapt an Agent Skill from real workflow expertise. Keep `SKILL.md` small, concrete, and portable across harnesses so an agent loads only what it needs and acts without guessing.

Read [references/spec-and-best-practices.md](references/spec-and-best-practices.md) when you need detailed frontmatter edge cases, instruction patterns, agentic script design rules, or description trigger optimization. Read [references/schemas.md](references/schemas.md) only when running an explicitly requested benchmark evaluation.

## Contents

- [Scope and target path](#scope-and-target-path)
- [1. Capture the job from real expertise](#1-capture-the-job-from-real-expertise)
- [2. Structure for progressive disclosure](#2-structure-for-progressive-disclosure)
- [3. Write frontmatter](#3-write-frontmatter)
- [4. Write instructions and file references](#4-write-instructions-and-file-references)
- [5. Bundle scripts only when earned](#5-bundle-scripts-only-when-earned)
- [6. Verify and deliver](#6-verify-and-deliver)
- [Optional benchmarking](#optional-benchmarking)

---

## Scope and target path

Classify the target location before writing any files:

| Scope | Where to write | Rule |
|---|---|---|
| Explicit path given | Exact path the user named | Follow the user's path literally. |
| Repository skill | `<repo>/.agents/skills/<name>/SKILL.md` | Default when modifying a target repository with no path specified. |
| Personal / global skill | User-named global or tracked folder | Ask which folder if the user did not name one; never guess a global path or auto-copy across repos. |

- 🎯 **Edit in place:** resolve the real repository root and write directly to the target folder unless isolation was requested.
- 🛡️ **Never overwrite silently:** if the skill folder already exists, read it first, preserve unrelated files and license notices, and make targeted edits.

---

## 1. Capture the job from real expertise

Skills built from generic LLM knowledge produce vague advice ("handle errors appropriately"). Ground every skill in concrete project or domain reality:

1. **Extract from hands-on work or artifacts:** pull exact commands, API shapes, conventions, corrections made during a real session, runbooks, or historical fixes.
2. **Define five boundaries:**
   - **Trigger:** when the agent should load the skill (and nearby cases where it should *not*).
   - **Inputs:** files, arguments, or context expected.
   - **Procedure:** step-by-step actions or decision rules.
   - **Outputs:** exact format, template, or side effect produced.
   - **Stop condition:** validation gate or boundary where the skill hands back control.
3. **Check adjacent skills:** keep each skill a coherent unit of work. If adapting an existing skill, copy its full folder first, then separate portable instructions from host-specific adapters.

---

## 2. Structure for progressive disclosure

Agents load skills in three tiers:

1. **Catalog (~50 to 100 tokens):** `name` and `description` loaded at session startup.
2. **Instructions (< 5,000 tokens, < 500 lines):** full `SKILL.md` body loaded when activated.
3. **Resources (on demand):** supporting files loaded only when `SKILL.md` directs the agent to read or run them.

```text
<skill-name>/
├── SKILL.md          # Required: YAML frontmatter + core workflow (< 500 lines)
├── references/       # Optional: detailed docs loaded on demand (flat, one level deep)
├── scripts/          # Optional: non-interactive CLI helpers and validators
└── assets/           # Optional: output templates, schemas, static lookups
```

Every path in a skill is relative to the skill root, the folder that holds `SKILL.md`. This applies to paths in `SKILL.md`, in `references/`, and in commands the agent runs from that root. A script that acts on the caller's current directory, such as one that finds the repo root from cwd, must be called by absolute path. Write `<skill dir>` in the command. Before running it, the agent replaces `<skill dir>` with the absolute path of the folder holding the installed `SKILL.md`. That location varies: a global folder, a repo, or a plugin cache.

- ✂️ **No empty scaffolding:** create `references/`, `scripts/`, or `assets/` only when they hold real files.
- 🧱 **Body stands alone:** some harnesses strip YAML frontmatter before injecting `SKILL.md`. Put all execution requirements inside the Markdown body.

---

## 3. Write frontmatter

Every `SKILL.md` starts with YAML frontmatter enclosed by `---`:

```markdown
---
name: example-skill
description: "Extract tables and form fields from PDF files. Use when the user asks to parse, fill, or merge PDFs."
license: Apache-2.0
metadata:
  last_updated: "2026-10-25T00:00:00Z"
  author: Example Author
  repository: https://github.com/example/repo
---
```

| Field | Required | Constraints |
|---|---|---|
| `name` | Yes | 1 to 64 chars. Lowercase alphanumeric and single hyphens (`^[a-z0-9]+(-[a-z0-9]+)*$`). Must match the parent folder name exactly (NFKC normalized). No leading, trailing, or consecutive hyphens (`--`). Never use `claude`, `anthropic`, or `synced`. No `<` or `>`. |
| `description` | Yes | 1 to 1,024 chars, non-empty. Imperative phrasing ("Use when..."). No `<` or `>`. Quote the string or use a YAML block scalar (`>` or `\|`) whenever it contains a colon (`:`). |
| `license` | No | Short license identifier or reference to bundled `LICENSE.txt`. |
| `compatibility` | No | Max 500 chars. Omit unless the skill requires specific system packages, runtimes, or network access. |
| `metadata` | No | String-to-string map for `author`, `repository`, `last_updated`, or `version`. Kept out of initial discovery prompts in Claude Code. |
| `allowed-tools` | No | Experimental space-separated tool list. Omit in portable cross-harness skills unless requested. |

- 🚫 **Never invent top-level keys:** only the six keys above are valid in `SKILL.md`. Put host-specific config in optional adapter files (such as `agents/openai.yaml`) after verifying the host's rules.
- 🔍 **Discover local conventions:** check the target repo's `AGENTS.md` or git config for required skill prefixes (such as `jookoi-`) and `metadata` fields rather than hardcoding personal defaults.
- 🎯 **Size `description` by invocation:**
  - *On-request skills:* 1 to 2 direct sentences stating what the skill does and when to use it.
  - *Self-triggering skills* (memory, docs, style, safety that must fire mid-task without the user naming the skill): list the specific events and user phrasings that trigger it, up to 1,024 characters.

---

## 4. Write instructions and file references

> [!WARNING]
> **Two rules agents violate most often:**
> 1. **Write root-relative paths without a leading `./` or `../`:** `references/guide.md` and `scripts/run.py`. Even inside `references/guide.md`, shell commands invoke `python scripts/run.py`, not a path relative to that file.
> 2. **Keep references strictly one level deep from `SKILL.md`.** `SKILL.md` links directly to `references/<file>.md`. Never create subdirectories inside `references/`, and never chain `references/a.md` to `references/b.md`.

Follow these instruction design rules (details in [references/spec-and-best-practices.md](references/spec-and-best-practices.md#instruction-design-patterns)):

- **Add what the agent lacks, omit what it knows:** cut textbook explanations. Ask of every line: *Would the agent get this wrong without this instruction?* If no, delete it.
- **Attach a "when to read" condition to every reference link:** write `Read [references/api-errors.md](references/api-errors.md) if the API returns a non-200 status`, never a bare `See references/ for details`.
- **Match specificity to fragility:** give goals and explain *why* when multiple approaches work; give exact commands and flags when an operation is fragile or stateful.
- **One default with escape hatches:** pick one recommended tool or path and note the fallback in one line instead of offering a menu of options.
- **Put a `## Gotchas` section in `SKILL.md`:** keep non-obvious traps in `SKILL.md` where the agent sees them before making the mistake.
- **Use concrete templates and validation loops:** provide an inline or `assets/` template for structured outputs, and instruct the agent to run a validator or checklist and fix errors before finishing.

---

## 5. Bundle scripts only when earned

Prefer plain Markdown instructions first. For standard ecosystem tools, use pinned one-off commands (`npx eslint@9.0.0`, `uvx ruff@0.8.0`). Add a script in `scripts/` only when mechanical work is repeated across runs or a command is too error-prone to compose inline.

When writing a bundled script (full rules in [references/spec-and-best-practices.md](references/spec-and-best-practices.md#bundling-and-designing-scripts)):

- **Zero interactive prompts:** agents run in non-interactive shells and hang on TTY prompts. Require all inputs via flags, env vars, or stdin.
- **Self-contained dependencies:** use PEP 723 inline `# /// script` headers for Python (`uv run scripts/tool.py`) or `npm:`/`jsr:` specifiers for Deno/Bun so no separate install step is needed.
- **Agent-friendly I/O:** support `--help`, emit structured output (JSON/CSV) to `stdout`, send diagnostics to `stderr`, cap output size, and write error messages that state what was expected and how to fix the call.

---

## 6. Verify and deliver

Default verification is lightweight and runs on every skill creation or edit. Do not run prompt suites, subagent grading, or benchmark loops unless the user explicitly asks for benchmarking.

- [ ] **Run the validator:** execute `python scripts/quick_validate.py <path/to/skill-folder>` (from this skill's directory) to verify frontmatter keys, naming rules, line budget, root-relative links, and one-level reference depth.
- [ ] **Run repo checks if applicable:** if the target repo defines its own skill audit command in `AGENTS.md` (for example `npm run update-skills`), run it or follow its cross-reference checklist.
- [ ] **Test bundled scripts:** if you added or edited a script in `scripts/`, run it with `--help` and one real or dry-run input.
- [ ] **Check trigger clarity:** read the `description` against one realistic prompt that should trigger the skill and one near-miss prompt that should not.
- [ ] **Package only on request:** run `python scripts/package_skill.py <path/to/skill-folder>` only when the user asks for a distributable `.skill` archive.

Report the written path, what changed, what validation ran, and any host-specific caveats.

---

## Optional benchmarking

Run this workflow **only** when the user explicitly asks to evaluate, benchmark, or optimize a skill across test prompts.

1. Define 2 to 3 realistic test prompts (plus an edge case and a near-miss negative case for trigger testing) in `evals/evals.json` following [references/schemas.md](references/schemas.md).
2. Run each case in an isolated workspace with and without the skill (or against a snapshot of the prior version). Record prompts, outputs, `timing.json`, and side effects. If the harness cannot run isolated subagents, run sequentially and state that limitation plainly.
3. Grade assertions with `agents/grader.md`, aggregate statistics with `python scripts/aggregate_benchmark.py <workspace> --skill-name <name>`, and optionally compare blind outputs with `agents/comparator.md` and `agents/analyzer.md`.
4. To generate a standalone human review page, run `python eval-viewer/generate_review.py <workspace> --static <output.html>`.
5. Fix the smallest root cause revealed by failed assertions or execution transcripts, generalize the instruction rather than patching for one prompt, and re-run affected cases.
