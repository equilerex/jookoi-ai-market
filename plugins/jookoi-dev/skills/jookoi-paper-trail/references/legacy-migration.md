# Legacy migration

How to bring a repo on the old layout over to the current one. Agent-driven with user approval. There is no `migrate` command: few repos run the old system and each holds little history, so judgement per item beats a script.

Order: decisions, then `TODO.md`/`BACKLOG.md`, then `items.json`, then stale context files, then hooks: run `hooks`, and if this harness's gate or rehydrate is missing, offer the merge in `references/hooks.md`. On a harness without hooks, propose the `AGENTS.md` line from `references/hooks.md` instead. A repo adopted with neither gets no session-start list and no end-of-turn check. Present what you found and what you propose before changing anything. Never run `git commit`, `git push`, `git add` or `git mv`.

Treat the shared layer (`_architecture/`) and the private layer (`_jookoi-architecture/`) separately. Private content is promoted only into private docs.

## Decisions (`plans/decisions/`, ADR folders)

Most decisions should not survive as files. A decision records why a rule exists. The rule belongs in a live doc. Survivors move to `plans/decision-history/`.

1. Find every decision folder: `_architecture/plans/decisions/`, `_jookoi-architecture/plans/decisions/`, `docs/adr/`, `decisions/`, numbered `NNN-*.md` files. None found: stop. Ambiguous layout: ask.
2. Read the live docs a decision could already live in: `ARCHITECTURE.md`, the repo `AGENTS.md`/`CLAUDE.md`, `CONTEXT.md` files, files under `plans/`. Do not read `archive/`.
3. Read each decision in full and give it one class:

   | Class | Meaning | Action |
   |---|---|---|
   | Integrated | The rule or fact is already in a live doc | Delete |
   | Promote | Durable content not yet in any live doc | Move its essence into the right live doc, then delete |
   | In a plan | The call and its reasoning are in a plan file | Delete, keep the plan |
   | Redundant | Superseded, obsolete or trivial | Delete |
   | Keep | Non-obvious reasoning held nowhere else and likely to be asked about. Rejected options usually land here, since a rejected option leaves no trace in the live docs | Move to `decision-history/` |

   For each file, grep the repo for inbound links (archive included, as grep hits only) and run `find` for mentions in the store.
4. Present one table and stop: `# | Title | Class | Evidence (file:line where the content already lives) | Proposed action | Inbound links`. Promote rows show the exact text to add. Wait for approval per row.
5. Apply the approved rows.
   - Promote: write the essence as a present-tense fact or rule, no changelog wording, in the section where it belongs.
   - Before deleting a file, repoint every inbound link to the live doc or plan that now holds the content. In `archive/` and historical plans change only the link target. No sensible target: remove the link, keep the text.
   - Store items that mention a decision path change only through the script's `edit`.
6. Move Keep files to `plans/decision-history/`, keeping filenames and numbers (gaps are fine), repoint links, remove the empty old folder, and write `decision-history/index.md`:

   ```markdown
   # Decision history

   Background on why rules exist. Not rules. Open a file only when a doc cites it or the user asks why.

   - [NNN Title](NNN-slug.md): one line on what it explains.
   ```

   Update the old folder path in `AGENTS.md`, `ARCHITECTURE.md` and the README. A doc that frames decisions as rules to follow ("don't relitigate") is reworded to match the index header.
7. Report the final class per file, the live docs edited and their sections, the links repointed as `file:line`, references left in place and why, store items touched as `id title`, and a grep for the old folder path.

## `TODO.md`, `BACKLOG.md`, checklists

`find` each entry first. `add` whatever is still live (`--status=parked` for backlog entries). Fold standing context into `AGENTS.md` or `ARCHITECTURE.md`. Delete the files after the user approves.

## `items.json` (v2 store)

Convert to `items.yaml` and verify field by field.

- `title = content[0]`, `body = content.slice(1)` with one leading empty line dropped if present, joined with `\n`. Items with no blank line after the title lose their body under a rule that expects one, so round-trip every item.
- Drop `next_id`. Add `repo:` (the root folder's name, lowercased). Keep the existing IDs, an ID is an opaque string.
- Dump with the vendored `js-yaml`: `{ schema: CORE_SCHEMA, lineWidth: -1, noRefs: true }`.
- Verify item count, and per item title, body, status, priority and all four timestamps against the source. Convert any `archive/items-*.json` the same way, then remove the JSON files.

## Stale context files

Grep `CONTEXT.md`, `AGENTS.md`, `ARCHITECTURE.md` and the README for `TODO.md`, `BACKLOG.md`, `items.json`, `next_id` and `plans/decisions`, and fix each mention to the current layout.
