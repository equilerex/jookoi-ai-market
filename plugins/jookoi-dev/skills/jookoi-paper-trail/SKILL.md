---
name: jookoi-paper-trail
description: Writes anything worth remembering into the repo's own files instead of losing it to the transcript — folder-level CONTEXT.md, and the project-level TODO.md / BACKLOG.md / ARCHITECTURE.md / plans / decisions / archive pipeline. Use this whenever something durable just happened or is about to be written down: a decision got made or rejected, a design or planning session wrapped, a change made an existing doc wrong, real work started in a folder with no context file, an item is worth logging for later, or a chunk of work finished and the notes need archiving. Trigger it on phrasings like "write this down", "note that", "update the docs", "log it for later", "we settled on X", "docs are stale", "we're done with this chunk" — the user names the fact, not the file, so match on the intent rather than on a filename.
---

# jookoi-paper-trail

Every repo keeps its own written memory: `CONTEXT.md` beside the code it describes, and `_architecture/` at the root holding `TODO.md` (the live working set), `BACKLOG.md`, `ARCHITECTURE.md`, `plans/`, and `archive/`. This skill decides what lands where and keeps the formats intact.

Two things move information through this system: a **script** that owns every mechanical decision, and **you**, who own what happened and where it belongs. Don't do by hand what the script does — that is where the format drifts.

## When this runs

- **After a change that makes an existing context file wrong.** Immediately, before continuing the original task — a doc that is confidently wrong costs more than one that is absent.
- **First real work in a folder with no context file.** Create one. Never bulk-generate across a tree: a context file earns its place the first time real work happens there, and mass-produced ones are wrong on arrival.
- **When a chunk of work finishes, or the checklist runs dry**: `flush`. On judgement only — never on a cadence, never because a hook asked; the `Stop` gate only ever asks for a `TODO.md` update. Flush archives `TODO.md` whole and wipes it, so move anything still live to `BACKLOG.md` *first*. Mechanics: `references/pipeline.md`.
- **Every session in between**: edit `TODO.md` directly as things happen — check items off, add new ones, rewrite `## Context` when it goes stale. `TODO.md` sitting untouched across sessions is the steady state, not a bug.
- **`BACKLOG.md` has items and `TODO.md`'s checklist is thin.** Pull one in and scope it into a checklist line.

## Routing

Top to bottom, first match wins.

| Ask | Destination |
|---|---|
| Folder-local context for code, needed by whoever works in that folder? | `CONTEXT.md` in that folder |
| A call that was made — picked, rejected, deferred — with reasoning that will be asked about later? | `plans/decisions/NNN-slug.md` (`new-decision`) |
| The record of a design or planning session, multi-part, one sitting? | `plans/YYYY-MM-DD-topic.md` (`new-plan`) |
| Durable and structural — why the repo is shaped this way? | `ARCHITECTURE.md` |
| Work worth tracking now — done, in progress, or picked up next? | `TODO.md`'s `## Checklist` |
| Intended work, not yet scoped or ordered? | `BACKLOG.md` (`backlog`) |
| A standing fact a cold session needs and would otherwise re-derive? | `TODO.md`'s `## Context` — rewrite wholesale, don't append |

No match: ask. Don't pick the closest bucket — wrong-bucket content is worse than absent content, because it gets found later and trusted.

## Shared or private

Both layers can sit side by side in one folder — `CONTEXT.md` next to `_jookoi-CONTEXT.md`, `_architecture/` next to `_jookoi-architecture/`. The routing table picks the file *type*; this picks the layer, and it's a second question asked every time, not a fallback for when the first one fails. Same tree, same formats, `--private` on the script.

The test is audience, not secrecy. **Shared** (no prefix, committed) is what stays true for whoever works in this repo next, including when that isn't the user: how the code is built, why it's shaped this way, what breaks. **Private** (`_jookoi-` prefix, gitignored, mirrored to the personal vault) is what's true for this user or this machine rather than for this repo: local paths and environment, judgements about people, vendors or clients, opinions not ready to ship, cross-repo threads a contributor here has no stake in, and anything about the work rather than the code.

- **Split a note that straddles.** The technical half is shared and useful to everyone; the personal half is private. Writing the whole thing private hides the useful half from the repo — the more common failure than over-sharing.
- **Shared files never link to private ones.** The link dangles for everyone but this user, and its filename leaks what was meant to stay unseen. Private → shared is fine.
- **Repo you can't commit to → everything private.** No shared layer to write to, so `--private` is the whole answer there.
- **Both present, conflicting? Private wins on read** (`references/operations.md`) — so a private note that contradicts a shared one silently overrides it. Correct the shared file instead of shadowing it, unless the contradiction is genuinely personal.

## The script

Run it from inside the target repo — it locates `_architecture/` with `git rev-parse --show-toplevel` against the current directory, so running it from the skill folder writes to the wrong place. `--root <path>` overrides.

```
node ~/.agents/skills/jookoi-paper-trail/scripts/jookoi-paper-trail.js <command> [args] [--root <path>] [--private] [--dry-run]

backlog "<title>" "<body>" [--status OPEN]
flush [--title "<t>"]              TODO.md -> archive/, resets TODO.md to template
status                             checklist counts, last flush date, marker state
stale                              updated: vs each folder's last commit
check                              validate managed files against the spec
new-decision "<title>"             next free NNN from template
new-plan "<topic>"                 dated plan file from template
```

It owns dating, heading grammar, newest-first insertion, duplicate rejection, archive-index pointers, `NNN` allocation, and template instantiation. It refuses rather than guesses: a file that doesn't match its expected shape is reported with a line number and left untouched. Fix by hand, then re-run.

No Node available? `references/file-formats.md` specifies every rule the script enforces, and `references/pipeline.md` has the manual order.

## Hard rules

- **Never regenerate a file to change one section.** Target the heading, rewrite to the next one, leave every other byte alone. Regeneration silently drops what this session didn't happen to be thinking about, and review can't catch it because the whole file shows as changed. (`TODO.md` is the exception in both directions — see `references/operations.md`.)
- **Never write a secret.** API key, token, credential, connection string — flag it, don't record it.
- **Never leave a placeholder.** `TBD` / `TODO` / `[...]` — fill it or drop the section.
- **Never restate what the code shows**, document parameters, log a changelog, or explain framework behaviour. If removing a line wouldn't slow a newcomer down, cut it.
- **Never duplicate across levels.** Keep content at the more specific level; delete the copy.
- **Never carry a wiped name forward.** Once something is removed or rejected, live docs stop naming it — the decision record holds the name and the reasoning. Full rule: `references/file-formats.md`.
- **A folder's `CONTEXT.md` dies with the folder** — but check inbound references and promote anything durable first (`references/operations.md`).

## Bundled assets

| Load when | File |
|---|---|
| Writing or validating any managed file | `references/file-formats.md` |
| Flushing, recovering a dead session, handling compaction | `references/pipeline.md` |
| Finding, removing, staleness, section-surgical edits | `references/operations.md` |
| Wiring the session-end gate on any harness | `references/hooks.md` |
| Creating a file that doesn't exist yet | `assets/templates/<type>.md` (`todo.md` for `TODO.md`) |
| Any mechanical operation | `scripts/jookoi-paper-trail.js` |
