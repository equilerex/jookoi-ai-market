# Legacy migration

How to bring a repo on the old layout over to the current one. Agent-driven with user approval. There is no `migrate` command: few repos run the old system and each holds little history, so judgement per item beats a script.

Order: decisions, then `TODO.md`/`BACKLOG.md`, then `items.json`, then plan and archive folders, then stale context files, then hooks: run `hooks`, and if this harness's rehydrate hook is missing, offer the merge in `references/hooks.md`. On a harness without hooks, propose the `AGENTS.md` line from `references/hooks.md` instead. A repo adopted with neither gets no session-start list. Present what you found and what you propose before changing anything. Never run `git commit`, `git push`, `git add` or `git mv`.

Treat the shared layer (`_architecture/`) and the private layer (`_jookoi-architecture/`) separately. Private content is promoted only into private docs.

## Decisions (`plans/decisions/`, ADR folders)

Most decisions should not survive as files. A decision records why a rule exists. The rule belongs in a read-path doc. Survivors move to `plans/archived-decisions/`, and the doc that holds their rule links to them.

1. Find every decision folder: `_architecture/plans/decisions/`, `_architecture/plans/decision-history/`, the same under `_jookoi-architecture/`, `docs/adr/`, `decisions/`, numbered `NNN-*.md` files. None found: stop. Ambiguous layout: ask.
2. Read the live docs a decision could already live in: `ARCHITECTURE.md`, the repo `AGENTS.md`/`CLAUDE.md`, `CONTEXT.md` files, files under `plans/`. Do not read `archive/` or `archived-*`.
3. Read each decision in full and give it one class:

   | Class | Meaning | Action |
   |---|---|---|
   | Integrated | The rule or fact is already in a live doc | Delete |
   | Promote | Durable content not yet in any live doc | Move its essence into the right live doc, then delete |
   | In a plan | The call and its reasoning are in a plan file | Delete, keep the plan |
   | Redundant | Superseded, obsolete or trivial | Delete |
   | Keep | Footnote to a rule in a read-path doc, with reasoning that would bloat that doc and is likely to be asked about again. Rejected options usually land here, since a rejected option leaves no trace in the live docs. Ordinary implementation never qualifies | Move to `archived-decisions/` |

   For each file, grep the repo for inbound links (archive included, as grep hits only) and run `find` for mentions in the store.
4. Present one table and stop: `# | Title | Class | Evidence (file:line where the content already lives) | Proposed action | Inbound links`. Promote rows show the exact text to add. Wait for approval per row.
5. Apply the approved rows.
   - Promote: write the essence as a present-tense fact or rule, no changelog wording, in the section where it belongs.
   - Before deleting a file, repoint every inbound link to the live doc or plan that now holds the content. In `archive/` and historical plans change only the link target. No sensible target: remove the link, keep the text.
   - Store items that mention a decision path change only through the script's `edit`.
6. Move Keep files to `plans/archived-decisions/`, keeping filenames and numbers (gaps are fine), add a `Linked from:` line to each, add a link to it from the doc that holds its rule, repoint other links, and remove the empty old folder. Delete `index.md`, since archived folders have no index. Update the old folder path in `AGENTS.md`, `ARCHITECTURE.md` and the README. A doc that frames decisions as rules to follow ("don't relitigate") is reworded to say the file is background for the linked rule.
7. Report the final class per file, the live docs edited and their sections, the links repointed as `file:line`, references left in place and why, store items touched as `id title`, and a grep for the old folder path.

## Plans and archive folders

Old names map to new ones. No `migrate` command: check each plan's `Status:` rather than trusting the folder it sits in.

| Old | New |
|---|---|
| `plans/implemented/` | `plans/archived-plans/`, after the status check below |
| `plans/decision-history/`, `plans/decisions/` | `plans/archived-decisions/` (see Decisions above) |
| `archive/items-*.yaml` | `archived-items/` |
| `archive/YYYY-MM.md` | delete after confirming nothing durable is left in it, or move to `archived-items/` |

For every plan at `plans/` root or in `implemented/`:

1. Read its `Status:` line and compare with the code and `ARCHITECTURE.md`. `implemented/` is not proof that it was approved or built, and a plan at root may be built.
2. Built: fold-out audit. Confirm each durable outcome is in a read-path doc and add what is missing there, briefly. Then set `Status: done` and move it to `archived-plans/`.
3. Not built but in `implemented/`, or stale (says "not started" while the docs say built): fix the status after asking, then leave it at `plans/` root or archive it as above.
4. Not a plan (a HANDOFF note, research, a generated checklist, a mock or prototype, a runnable artifact with its own dependencies): move its content to the plan's progress or the item body, a `CONTEXT.md`, a linked `<topic>.ARCHITECTURE.md`, or next to its generator. Nothing runnable stays under `_architecture/`.
5. Source comments, READMEs and agent prompts that cite a plan or "read all decisions" are repointed to a read-path doc or the citation is removed.

Consolidate over-granular items in `items.yaml` at the same time: merge siblings that describe one piece of work, run `check` after.

## `TODO.md`, `BACKLOG.md`, checklists

`find` each entry first. `add` whatever is still live (`--status=parked` for backlog entries). Fold standing context into `AGENTS.md` or `ARCHITECTURE.md`. Delete the files after the user approves.

## `items.json` (v2 store)

Convert to `items.yaml` and verify field by field.

- `title = content[0]`, `body = content.slice(1)` with one leading empty line dropped if present, joined with `\n`. Items with no blank line after the title lose their body under a rule that expects one, so round-trip every item.
- Drop `next_id`. Add `repo:` (the root folder's name, lowercased). Keep the existing IDs, an ID is an opaque string.
- Dump with the vendored `js-yaml`: `{ schema: CORE_SCHEMA, lineWidth: -1, noRefs: true }`.
- Verify item count, and per item title, body, status, priority and all four timestamps against the source. Convert any `archive/items-*.json` the same way, then remove the JSON files.

## Stale context files

Grep `CONTEXT.md`, `AGENTS.md`, `ARCHITECTURE.md` and the README for `TODO.md`, `BACKLOG.md`, `items.json`, `next_id` and `plans/decisions`, `plans/decision-history`, `plans/implemented` and `archive/`, and fix each mention to the current layout.
