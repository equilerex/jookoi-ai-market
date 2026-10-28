---
name: jookoi-convert-docs-to-skill
description: Use when the user wants an agent skill that makes an agent an expert helper for a specific application, framework, SDK or tool, built from its documentation, changelog, community forum and a real install. Covers intake, source gathering and scraping, user-language mapping, design, drafting, verification and handoff. Not for small single-file skills with no documentation corpus.
compatibility: Any agent harness that reads SKILL.md. Bundled research scripts need Python 3 (PyMuPDF for PDF extraction). The produced skill's own helpers should need nothing beyond what the target platform ships.
metadata:
  version: "0.1.0"
  last_updated: "2026-10-25T00:00:00Z"
  author: Joosep Kõivistik
  repository: https://github.com/equilerex/jookoi-ai-market
---

# Convert docs to a skill

Build a skill that lets an agent answer "can this app do X, and how?" in the user's own words, and, where the target allows it, apply the change safely. The manual is research input, not the product. The product is a small, tested skill folder in your own writing, organised around how people ask, not how the manual is laid out.

## Roles

| Role | Who | Owns |
|---|---|---|
| Owner | the user | sources the agent can't fetch, every call in Intake, approval before live changes and scraping, final review |
| Orchestrator | main session | intake, design, the authoring spec, reviewing drafts, all live tests on the user's machine, docs, recording |
| Researchers | subagents | heavy reading: extract structure, forum corpus grep, changelog. Return findings, not dumps |
| Drafters | subagents, one per reference file | write one file against the authoring spec. No live commands, no advisor calls |
| Verifier | a script or subagent | cross-check every cited command, option and path against the generated index |
| External reviewer | a different model, run by the owner | reviews the finished skill cold |

Heavy reading goes to subagents. Live tests stay in the main session: they can leave dialogs or changed state on the owner's screen, and only the main session can see and clean that up.

## Bundled scripts

Research tools, run with `python -I`. They write to the research folder, never into the produced skill except generated reference files.

| Script | Does |
|---|---|
| `scripts/extract_manual.py <pdf> <out-dir>` | PDF to one text file per top-level bookmark plus `INDEX.md` (needs PyMuPDF) |
| `scripts/build_command_index.py <extract-dir> <out.md> <first> <last>` | generate a grep-only command and argument index from numbered command sections. Adapt its regexes to the manual's layout |
| `scripts/forum_fetch.py <base-url> <out-dir> topics or listing or solved ...` | polite Discourse JSON fetch, 10 s apart, honours Retry-After, resumable |
| `scripts/forum_corpus.py <capture-root> <out.jsonl> --staff ... --categories ...` | HTTrack HTML and Discourse JSON into one JSONL corpus, merged incrementally |
| `scripts/kb_tools.py prep` or `index` | bundle extract sections for a drafter, and lint and index distilled kb entries |

## Phases

Record calls and progress in a plan file as you go (use the repo's paper-trail skill if present). Each phase ends with its output written down.

1. **Intake.** Agree the decisions in `references/requirements-checklist.md`. Ask only what changes the design. Ask for missing sources by name (see phase 2). Output: the plan with every call recorded.
2. **Gather.** Follow `references/sources.md`. Get the official manual (PDF, CHM, HTML or online), the changelog or release notes, the community forum, tutorials, typings and the owner's real install. Scraping or bulk fetching needs the owner's OK. Raw material goes to a gitignored research folder, never into the skill.
3. **Extract.** One text file per manual section, plus an index with title, path and size, so agents grep and read only what they need (`extract_manual.py`). Generate any large lookup table (commands, options, API members) from the extract with a script (`build_command_index.py`). Never write one by hand.
4. **Demand analysis.** Mine the forum for what people ask, in which words, how often (views, replies), and how staff answer. Output a domain doc: question clusters with proportions, the user vocabulary, triage types, recurring pitfalls, known limits, companion tools, staff resolution patterns. This sets the file layout and the depth of each file.
5. **Apply-safety spike** (only if the skill will change the app). Before designing, test on the real install how config can be changed safely. See `references/apply-safety.md`.
6. **Design.** Use the target shape in `references/skill-shape.md`: request pipeline, mental model, user-language map, one reference file per surface or embedded language, generated index, runtime fallback. Set token budgets. Write the authoring spec from `assets/authoring-spec.md`.
7. **Draft.** Parallel drafter subagents, one file each, against the spec. Give each one its extract sections bundled by `kb_tools.py prep`. Two products: task-oriented reference files, and a distilled knowledge base (one short entry per feature or settings page) indexed by `kb_tools.py index`. The orchestrator reads each result and checks its report of unverified claims.
8. **Verify.** Cross-check every cited name against the generated index. Test the claims that matter for applying changes, and the most common recipes, on the real install. Run one realistic question end to end (the vertical slice), including apply, on-screen check and revert. Tag the rest `[unverified]` in place.
9. **Document and hand off.** README (what it solves and how it was built, with numbers), ARCHITECTURE (design, evidence, verification rules, tested facts, constraints), `.gitignore` for licensed and scraped material, a secrets scan before the first commit, a handoff with open items. Then the owner runs the external review.

## Non-negotiables

- **Built from scratch.** No manual text in the skill. Check the manual's licence before deciding what may ship.
- **Every fact is sourced.** From the manual for the installed major version, or a test. Community answers and model memory are hints until confirmed. Tag in place: `[tested <version>]`, `[unverified]`, `(x.y+)` for version gates.
- **Map the user's words.** People name what they see ("the bar on top"), not features. A phrase-to-concept table is a first-class reference, not an afterthought.
- **Triage before answering.** A good share of real questions are bugs, conflicts, licensing or "not possible". The skill must say so honestly and name the nearest workaround.
- **Least power first.** Setting, then built-in command, then expression or macro, then script.
- **Explain, ask, then act.** The explanation is the user's review. Changes need an explicit yes.
- **Ask, don't guess, for missing inputs.** Name the exact file, URL, version or permission needed and why.

## Lessons from earlier builds

- The manual is often newer than the installed version, and features documented in it can fail on the install. Record both versions and test version-sensitive features.
- Forum tutorials predate the current major version. Old names survive in popular answers. Check every step.
- Popularity is the best depth signal. The most viewed topics deserve the deepest files and tested recipes.
- "How do I install what I found on the forum" is often its own demand cluster. Cover every shareable format and its install route.
- Generated indexes have gaps. When a cross-check fails, look for a renamed item in the changelog or a generator miss before calling the reference wrong.
- CLI bridges into a running app can mangle quoting (backslashes, nested quotes) and report nothing. Errors often appear only as GUI dialogs. Build detection for them.
- A failed command can open an interactive dialog instead of failing. Keep test leftovers cleaned: list them and remove them before reporting.
- Stop after two failures on the same test and reframe. Repeating it piles up side effects on the owner's machine.
