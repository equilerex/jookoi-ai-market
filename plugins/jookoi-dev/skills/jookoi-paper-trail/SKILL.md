---
name: jookoi-paper-trail
description: Repo working memory kept current for the whole session, not set up once. Work items in items.yaml via a script, CONTEXT.md, ARCHITECTURE.md, plans, decision history. Use when a repo has _architecture/ or items.yaml, when the user asks to document or track work, or when a decision, config change or incident happens.
metadata:
  author: Joosep Kõivistik
  repository: https://github.com/equilerex/jookoi-ai-market
  last_updated: "2026-09-24T00:00:00Z"
---

# jookoi-paper-trail

Every repo keeps its own written memory: `CONTEXT.md` beside the code it describes, and `_architecture/` at the root holding `items.yaml` (the live working set: now, parked, done, dropped items), `ARCHITECTURE.md`, `plans/`, and `archive/`. There is no separate status or context file: work items are in the store, calls made in a planning session in that plan, calls made outside one in `plans/decision-history/`, durable facts in `ARCHITECTURE.md`, standing rules in `AGENTS.md`. This skill decides which of those a note lands in and keeps the formats intact.

Two things move information through this system: a **script** that owns every mechanical decision, and **you**, who own what happened and where it belongs. Items are written only through the script, by ID, with no prior read: never open or hand-edit `items.yaml`.

**Never show a bare ID to the user.** Every mention of an item, in a reply, a plan, a doc or another item's body, is `id title`, for example "k4f9 Migrate the store to YAML". The user cannot act on "start k4f9" without cross-referencing. Script output already follows this.

## Session contract

Once this skill is loaded, it stays in force until the session ends, including after compaction. Setting up the files is not the job. The job is recording things in the same turn they happen, because a note written at the end of the session is written from memory of a chat that has already lost detail.

- **First use in a session, and whenever you set up or adopt a repo:** run `list`, then `sweep`. If `sweep` reports missing hooks or a harness without them, follow `references/hooks.md` § Check and wire. Until hooks run, you are the gate: `sweep` before ending any turn that changed files.
- **After every write through this skill,** end your reply with one line: `paper-trail: <what was recorded>`. That leaves a trail in the transcript that survives compaction and shows the user what landed.
- **If you write a compaction summary,** keep a line saying jookoi-paper-trail is active in this repo and must be reloaded before the next write.

## When to write

Write in the same turn as the trigger, not at the end.

| Trigger | Destination | How |
|---|---|---|
| The user agrees to a call in chat (a tool, a provider, an approach, a rejection) | inside a planning session: that plan. Otherwise: `plans/decision-history/` | edit the plan's section, or `new-decision` |
| Deployment, configuration, credentials handling or an external service changes | `ARCHITECTURE.md` or the folder's `CONTEXT.md` | section-surgical edit |
| An incident: a leak, data loss, a broken deploy | an item with the remediation steps, plus a decision if a rule came out of it | `add --file`, `new-decision` |
| A task starts, finishes, is parked or abandoned | the store | `start`, `done`, `park`, `drop` |
| New work is identified | the store | `find` first, then `add --file` with a body |
| A change makes a doc's statement false (an interface, a path, a constraint) | that doc | fix it before continuing the original task |
| First real work in a folder with no context file | new `CONTEXT.md` there | from `assets/templates/CONTEXT.md`. Never bulk-generate across a tree |
| A chunk of work finishes, or `now` runs dry | suggest a flush | `references/flush-prompt.md`. Judgement only |
| A plan's `Status:` says done | `plans/implemented/`, unchanged | move the file (`references/file-formats.md`) |
| End of a turn that changed files | check nothing slipped | `sweep`, then record, or `sweep --ack` if nothing is worth recording |

Session start: `list` shows `now` items plus the 3 latest done. `list --status=parked` when `now` is thin. Untouched across sessions is the steady state.

## Items carry a body

An item is a scratchpad for the next session, not a to-do line. Anything that isn't obvious from its title gets a body: why it exists, what state it's in, the next concrete step, and pointers to files, plans or decisions. Title-only is for items whose title says everything. `add` and `edit` print a note when the body is empty.

```yaml
# add --file item.yaml
title: Rotate the leaked triage token
status: now
body: |
  Leaked in commit history on 24-09-2026 (decision 002). Redaction in `triage.js` stops
  new leaks but cannot un-leak this one: rotation is the real fix.

  Next: revoke in GitHub settings, create a fine-grained token (issues:write only),
  update the `TRIAGE_TOKEN` secret, re-run the triage workflow.
  Blocked on: ko2q Push the redacted history.
```

`--file` works in every shell. `add -` reads the same YAML from stdin.

## Routing

Top to bottom, first match wins.

| Ask | Destination |
|---|---|
| Folder-local context for code, needed by whoever works in that folder? | `CONTEXT.md` in that folder |
| A call made inside a planning session? | that plan, `plans/YYYY-MM-DD-topic.md` |
| A call made outside a planning session, with reasoning that will be asked about later? | `plans/decision-history/NNN-slug.md` (`new-decision`). Background on why a rule exists, not a rule: the rule goes to `ARCHITECTURE.md`, `AGENTS.md` or `CONTEXT.md`. Open it only when a doc cites it or the user asks why |
| The record of a design or planning session, multi-part, one sitting? | `plans/YYYY-MM-DD-topic.md` (`new-plan`) |
| Durable and structural — why the repo is shaped this way, including standing facts a cold session would otherwise re-derive? | `ARCHITECTURE.md` |
| A rule agents must follow every session in this repo? | the repo's `AGENTS.md` |
| Work item: tracked now, or logged for later? | The store: `add` (`--status=parked` if not started) |

No match: ask. Don't pick the closest bucket — wrong-bucket content is worse than absent content, because it gets found later and trusted.

## Shared or private

Both layers can sit side by side in one folder — `CONTEXT.md` next to `_jookoi-CONTEXT.md`, `_architecture/` next to `_jookoi-architecture/`. The routing table picks the file *type*; this picks the layer, and it's a second question asked every time, not a fallback for when the first one fails. Same tree, same formats, `--private` on the script.

The test is audience, not secrecy. **Shared** (no prefix, committed) is what stays true for whoever works in this repo next, including when that isn't the user: how the code is built, why it's shaped this way, what breaks. **Private** (`_jookoi-` prefix, gitignored, mirrored to the personal vault) is what's true for this user or this machine rather than for this repo: local paths and environment, judgements about people, vendors or clients, opinions not ready to ship, cross-repo threads a contributor here has no stake in, and anything about the work rather than the code.

- **Split a note that straddles.** The technical half is shared and useful to everyone; the personal half is private. Writing the whole thing private hides the useful half from the repo — the more common failure than over-sharing.
- **Shared files never link to private ones.** The link dangles for everyone but this user, and its filename leaks what was meant to stay unseen. Private → shared is fine.
- **Repo you can't commit to → everything private.** No shared layer to write to, so `--private` is the whole answer there.
- **Both present, conflicting? Private wins on read** (`references/operations.md`) — so a private note that contradicts a shared one silently overrides it. Correct the shared file instead of shadowing it, unless the contradiction is genuinely personal.

## The script

Run it from inside the target repo — it finds the root with `git rev-parse --show-toplevel`, else by walking up to a folder with `_architecture/`, so running it from the skill folder writes to the wrong place. `--root <path>` overrides. Paths are handled with Node's `path`, so the script runs the same on Windows and Unix. `~` expands in bash and zsh only. In PowerShell write `$HOME/.agents/skills/...` instead.

```
node ~/.agents/skills/jookoi-paper-trail/scripts/jookoi-paper-trail.js <command> [args] [--root <path>] [--private] [--dry-run]

list [--status=S] [--stale=N]      now items + 3 latest done; or one status
list --archived [--last N]          flushed items, newest first
find "<text>"  show <id>  count    search everything, one item (archived too), counts
add --title "<t>" | add - | add --file F   payload: YAML {title, body, status}
    [--after=ID|--before=ID|--first|--last]
done|park|start|drop <id>          status changes
edit <id> --title "<t>" | - | --file F   move <id> <placement>
flush [--before=DATE]              done+dropped -> archive/items-YYYY-MM.yaml
render                             store as markdown, for a human
stale [days]  check                stale items and context files; validate
sweep [--ack]                      uncommitted work vs store and context files
hooks [--print [--harness=H]]      which hooks are wired; --print: fragment to merge
new-decision "<title>"  new-plan "<topic>"
```

Item format, IDs, placement and errors: `references/store-format.md`. A repo still on the old system (`items.json`, `TODO.md`, `BACKLOG.md`, `plans/decisions/`): `references/legacy-migration.md`.

It owns IDs, dating, priorities, archiving, `NNN` allocation, and template instantiation. It refuses rather than guesses: an unknown ID or malformed store is reported and nothing is written.

No Node available? `references/pipeline.md` has the manual fallback.

## Hard rules

- **Never regenerate a prose file to change one section.** Target the heading, rewrite to the next one, leave every other byte alone.
- **Never write a secret.** API key, token, credential, connection string: flag it, don't record it. This covers item bodies and command output too. Don't print any part of a secret, not even a prefix.
- **Never leave a placeholder.** `TBD` / `TODO` / `[...]` — fill it or drop the section.
- **Never restate what the code shows**, document parameters, log a changelog, or explain framework behaviour. If removing a line wouldn't slow a newcomer down, cut it.
- **Never duplicate across levels.** Keep content at the more specific level; delete the copy.
- **Never carry a wiped name forward.** Once something is removed or rejected, live docs stop naming it — `plans/decision-history/` holds the name and the reasoning. Full rule: `references/file-formats.md`.
- **A folder's `CONTEXT.md` dies with the folder** — but check inbound references and promote anything durable first (`references/operations.md`).

## Bundled assets

| Load when | File |
|---|---|
| Writing or validating a prose file (CONTEXT, plan, decision) | `references/file-formats.md` |
| Item fields, commands, placement | `references/store-format.md` |
| Bringing a repo off the old layout | `references/legacy-migration.md` |
| Flushing | `references/flush-prompt.md` |
| Recovering a dead session, handling compaction | `references/pipeline.md` |
| Finding, removing, staleness, section-surgical edits | `references/operations.md` |
| `sweep` or `hooks` says hooks are missing, or wiring them on any harness | `references/hooks.md` |
| A browsable page over the store, one or many repos | `references/viewer.md` |
| Creating a file that doesn't exist yet | `assets/templates/<type>.md` |
| Any mechanical operation | `scripts/jookoi-paper-trail.js` |
