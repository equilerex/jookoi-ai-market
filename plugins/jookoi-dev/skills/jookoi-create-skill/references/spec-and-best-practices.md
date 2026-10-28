# Agent Skills Specification & Best Practices

Reference guide distilled from the Agent Skills specification (`agentskills/agentskills`). Read this file when validating edge cases, designing bundled scripts, or structuring progressive disclosure across multiple files.

## Contents

- [Directory layout and progressive disclosure](#directory-layout-and-progressive-disclosure)
- [Frontmatter specification](#frontmatter-specification)
- [File references and one-level nesting](#file-references-and-one-level-nesting)
- [Instruction design patterns](#instruction-design-patterns)
- [Bundling and designing scripts](#bundling-and-designing-scripts)
- [Description optimization](#description-optimization)

---

## Directory layout and progressive disclosure

```text
skill-name/
├── SKILL.md          # Required: YAML frontmatter + core instructions (< 500 lines)
├── scripts/          # Optional: executable scripts and mechanical helpers
├── references/       # Optional: detailed docs loaded on demand (flat, one level deep)
└── assets/           # Optional: output templates, schemas, static data
```

Skills load in three tiers to protect the context window:

| Tier | Loaded content | When it loads | Budget |
|---|---|---|---|
| 1. Catalog | `name` + `description` | Session startup for every discovered skill | ~50 to 100 tokens per skill |
| 2. Instructions | Full `SKILL.md` body | When the skill activates | < 5,000 tokens, < 500 lines |
| 3. Resources | Files in `references/`, `scripts/`, `assets/` | On demand when instructions direct the agent to read or run them | Only the specific file needed |

Some harnesses strip YAML frontmatter before injecting the `SKILL.md` body at activation time. Put anything the agent must follow during execution inside the Markdown body, not only in frontmatter.

---

## Frontmatter specification

`SKILL.md` starts with YAML frontmatter enclosed by `---` delimiters, followed by the Markdown body.

| Field | Required | Spec constraints and marketplace rules |
|---|---|---|
| `name` | Yes | 1 to 64 chars. Lowercase alphanumeric and single hyphens (`^[a-z0-9]+(-[a-z0-9]+)*$`). Must match parent directory name (NFKC normalized). No leading, trailing, or consecutive hyphens (`--`). Never use `claude`, `anthropic`, or `synced`. No `<` or `>`. |
| `description` | Yes | 1 to 1,024 chars, non-empty. States what the skill does and when to trigger it. No `<` or `>`. Quote or use a block scalar (`>` or `\|`) if the text contains a colon (`:`). |
| `license` | No | Short license identifier (for example `Apache-2.0`, `MIT`) or pointer to a bundled `LICENSE.txt`. |
| `compatibility` | No | 1 to 500 chars. Include only when the skill requires specific system binaries, runtimes, or network access. |
| `metadata` | No | String-to-string key-value map for provenance (`author`, `repository`, `last_updated`, `version`). Excluded from initial discovery prompts in Claude Code. |
| `allowed-tools` | No | Experimental space-separated list of pre-approved tools (for example `Bash(git:*) Read`). Support varies by harness; omit in cross-harness skills unless requested. |

> [!WARNING]
> Unquoted colons in `description` (such as `description: Use this skill when: the user asks...`) break strict YAML parsers. Always wrap descriptions containing colons in quotes or use a YAML block scalar.

---

## File references and one-level nesting

When a skill activates, the harness provides the skill's root directory path (`<skill-dir>`). Every path inside `SKILL.md` and supporting files resolves relative to that root directory.

- **Use root-relative paths without `./`**: write `references/api-errors.md`, `scripts/validate.py`, `assets/report-template.md`.
- **Commands in `references/*.md` stay root-relative**: an agent executes shell commands from the skill root (or resolves them against the skill root), not from inside `references/`. A code block inside `references/guide.md` must still invoke `python scripts/extract.py`, never `python ../scripts/extract.py`.
- **Keep references one hop from `SKILL.md`**: `SKILL.md` links directly to `references/<file>.md`. Never create subdirectories inside `references/` and never chain `references/a.md` -> `references/b.md`. Multi-hop chains waste turns and lose context.
- **Attach a load condition to every link**: tell the agent *when* to read the file (`Read [references/api-errors.md](references/api-errors.md) when the response status is non-200`). Bare "see references/ for details" links cause agents to either ignore the file or load everything upfront.

---

## Instruction design patterns

- **Add what the agent lacks, omit what it knows.** Cut textbook explanations (what a PDF is, how HTTP works, generic coding advice). Test every paragraph with: *Would the agent get this wrong without this instruction?*
- **Match specificity to fragility.** Give freedom and explain *why* when multiple approaches work. Be strictly prescriptive (exact commands and flags) when operations are fragile, stateful, or destructive.
- **Provide one default with escape hatches.** Pick a single recommended tool or approach (`Use pdfplumber for text extraction; fall back to pdf2image + pytesseract for scanned PDFs`) instead of a menu of equal options.
- **Favor reusable procedures over instance answers.** Teach how to solve the class of problem (read schema -> join on `_id` -> filter -> format) rather than hardcoding a single query.
- **Keep a `## Gotchas` section in `SKILL.md`.** Environment-specific traps that defy normal assumptions belong in `SKILL.md`, not hidden in `references/`, because the agent will not know it needs to look for a gotcha before hitting it.
- **Include output templates.** Agents pattern-match concrete Markdown or JSON templates more reliably than prose descriptions of a format. Put short templates inline; put long or conditional templates in `assets/`.
- **Build validation loops and plan-validate-execute steps.** For multi-step or destructive tasks, instruct the agent to generate an intermediate plan or output, run a validation script or checklist against the source of truth, fix errors, and proceed only when validation passes.

---

## Bundling and designing scripts

Bundle a script in `scripts/` when execution traces show the agent reinventing the same parsing, charting, or validation logic across runs, or when a shell command is too complex to get right on the first try.

### One-off commands vs self-contained scripts

- For existing ecosystem tools, call them directly with pinned versions (`npx eslint@9.0.0 --fix .`, `uvx ruff@0.8.0 check .`). State prerequisites in `SKILL.md` and `compatibility`.
- For bundled scripts that need third-party libraries, declare dependencies inline so the agent can run them in one command without managing virtual environments:
  - **Python (PEP 723)**: declare `# /// script` and `# dependencies = ["package>=1.0,<2"]` `# ///` at the top, run with `uv run scripts/task.py`.
  - **Deno / Bun**: use versioned `npm:` or `jsr:` specifiers directly in imports.

### Agentic script interface rules

1. **No interactive prompts.** Agents run in non-interactive shells; TTY prompts, confirmation menus, or password inputs hang indefinitely. Accept all inputs via CLI flags, env vars, or stdin.
2. **Support `--help`.** Keep `--help` output concise with flags and 1 to 2 examples.
3. **Actionable error messages.** State what failed, what value was received, and the valid options or usage pattern so the agent can self-correct on the next turn.
4. **Structured stdout, diagnostics on stderr.** Emit JSON, CSV, or TSV to `stdout`; send progress logs and warnings to `stderr`.
5. **Bounded output size.** Harnesses truncate large tool outputs (10K to 30K chars). Default to a summary or page limit and support `--offset` or `--output <file>`.
6. **Idempotency and `--dry-run`.** Make retries safe and support `--dry-run` for stateful or destructive actions.

---

## Description optimization

The `description` field carries the entire burden of model-driven activation. Note that models often skip skills on trivial one-step requests they can handle with basic tools; descriptions matter most when specialized conventions or workflows apply.

- **Use imperative phrasing focused on user intent:** start with what the skill does and "Use when..." listing concrete user goals, phrasings, and file types, even when the user does not name the skill's domain explicitly.
- **Size by invocation pattern:**
  - *On-request skills* (invoked directly by name or obvious domain task): 1 to 2 sentences stating what it does and its boundary.
  - *Self-triggering skills* (memory, documentation, style, safety that must fire mid-task without the user naming the skill): list the specific events and user phrasings that trigger it, up to 1,024 characters.
- **Test with near-miss negatives:** when evaluating trigger accuracy, use negative queries that share keywords with the skill but require a different action (for example, database ETL from a CSV vs analytical charting of a CSV). If optimizing across ~20 queries, split 60% train / 40% validation to avoid overfitting keywords.
