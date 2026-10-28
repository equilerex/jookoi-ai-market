---
name: jookoi-paper-trail
description: Keeps a repo's own written memory so the next session or agent can pick up the work. It covers plans for feature work, coarse work items in items.yaml (through a script), folder CONTEXT.md, ARCHITECTURE.md, and archived plans and decisions. Use it when feature or architecture work starts (suggest or draft a plan in _architecture/plans/), when a plan is approved, started, changed or finished (track it, fold durable facts out, close and archive it), when a call is made or rejected, a task starts or finishes, new work is found, config, deploy or topology changes, an incident happens, a doc becomes wrong, or real work starts in a folder with no context file. Trigger on phrasings like 'let us plan X', 'we are implementing X now', 'plan approved', 'write this down', 'note that', 'log it for later', 'we settled on X', 'docs are stale', 'we are done with this chunk'. The user names the fact, not the file, so match on intent.
metadata:
  author: Joosep Kõivistik
  repository: https://github.com/equilerex/jookoi-ai-market
  last_updated: 2026-10-09
---

# jookoi-paper-trail

Every repo keeps its own written memory: `CONTEXT.md` beside the code it describes, and `_architecture/` at the root holding `items.yaml` (the live working set), `ARCHITECTURE.md`, and `plans/`. This skill decides which file a note lands in, how a feature moves from plan to done, and keeps the formats intact.

Two things move information through this system: a **script** that owns every mechanical decision, and **you**, who own what happened and where it belongs. Items are normally written through the script, by ID, with no prior read. Editing `items.yaml` by hand is allowed for cleanup (merging or removing redundant entries). Run `check` after.

## Three tiers

Defined by whether an agent reads them unprompted.

| Tier | Files | Read |
|---|---|---|
| Read-path (durable truth) | root `README.md`, `AGENTS.md`, `_architecture/ARCHITECTURE.md`, folder `CONTEXT.md` | whenever relevant. Always current, edited in place |
| Working set | open plans in `_architecture/plans/`, `items.yaml` | while the work is open. Recently done items too, for handoff |
| Archived | `plans/archived-plans/`, `plans/archived-decisions/`, `_architecture/archived-items/` | only a specific file, when the user asks or an item or doc names it. Never swept, no index |

Rule: **anything durable must be findable from the read-path tier alone.** If a cold session needs an archived plan or decision to work correctly, the fold-out step was skipped.

Where a durable fact goes, most specific first: an inline comment beside the code it explains, then the folder's `CONTEXT.md`, then `ARCHITECTURE.md`, `AGENTS.md` or `README.md`. Dedicated files are for vital facts an agent could not infer without context, not for everything worth knowing.

Everything an agent should not read unprompted starts with `archived-`. The prefix is the instruction. Do not open an `archived-*` path unless a doc links the file, an item names it, or the user asks. Do not search it, and there is no index to browse.

## Plan and item do different jobs

| | Plan | Item |
|---|---|---|
| Answers | what are we building, how, and how far along is it | what work is open, and what just finished |
| Holds | design, reasoning, deliverables, progress, deviations, fold-out targets | one or two lines of state and a pointer to the plan |
| Granularity | one per feature or design question | one per implementation bubble, typically one per plan. Never one per change |
| Updated | in bulk every so often during the build, not after each edit | at start and at finish, and when the state changes meaningfully |
| Read by | whoever builds this feature | any agent picking the work up, including after a harness or model swap |

The plan is the main file. Progress tracking (checkboxes, notes) inside the plan is allowed and often cheaper than splitting it into items. The item is the handoff marker: an agent arriving cold reads open and recently done items, learns which plan is in flight and roughly where, and does not need another harness's session logs. Design never gets copied into the item.

Work without a plan uses items the same way: one item per piece of work, body updated as it moves, a parked item for found-but-not-started work.

## Lifecycle of feature work

1. **Suggest a plan when the work warrants it.** Work touching architecture or lifecycle (a new module, folder, dependency or external service, an interface or path other code relies on, several deliverables) normally gets a plan. If the user has not asked for one, suggest it or ask. "We're implementing feature X now" counts as asking. A small change, a fix or a doc tweak goes straight to work. The user decides.
2. **Draft in the repo.** `new-plan "<topic>"` creates `plans/YYYY-MM-DD-topic.md` at the start of planning, and drafting happens in that file, whatever the harness. Changes the user asks for are edits to that file. On approval the `Status:` line changes to ready. Do not use a harness plan mode that blocks file writes (Claude Code's does): it stops edits to the repo plan during review rounds. Draft in normal mode and change no code until the plan is ready. If the user did start in plan mode, put the approved text into the repo file right after leaving it. Implementation may start in a later session: the plan and its item are the handoff.
3. **Start.** `add` an item "Implement <plan title>" with the plan path and one line of state, then `start` it.
4. **Build.** Progress lives in the plan, updated in bulk. Calls the plan did not cover go into its `Implementation deviations`, not into decision files. If the plan changes, edit the plan in place. `edit` the item body when a milestone lands and the plan's own progress is not enough for a cold reader.
5. **Fold out.** Before closing, write each durable outcome into its read-path home: structure into `ARCHITECTURE.md`, folder gotchas into `CONTEXT.md`, rules into `AGENTS.md`, usage into `README.md`. The plan's `Fold-out` section names each target.
6. **Close.** `close-plan <file>` sets `Status: done` and moves the plan to `plans/archived-plans/`, with no other edit. Then `done` the item with the body "Implemented, plan moved to `plans/archived-plans/<file>`".

Completion is explicit. A plan is complete when the user says so, or when every deliverable is built and fold-out is written. "Approved" is not complete.

**Any agent using the skill tidies.** On any paper-trail use, if an open plan's status or the code shows it is built, fold it out and close it. If the status is ambiguous, ask rather than move. An archived plan whose status says not started is moved back to `plans/` by hand. There is no command for that.

`plans/` holds plans only. Handoff notes go into the plan's progress or the item body. Research and reference material goes to a `CONTEXT.md`, a linked `<topic>.ARCHITECTURE.md` or the repo's research folder. Generated files, mocks and anything with its own dependencies live next to their generator, never under `_architecture/`. Prompts that brief an agent cite read-path docs, never "read all decisions". Code comments cite a read-path doc or nothing, never a plan path.

## Why this is your job

The transcript is gone at the end of the session and cut down at every compaction. The next session, and the user reviewing at commit time, know only what is in these files. Work that isn't recorded is invisible work: a call nobody can find gets relitigated, and a doc that still describes the old setup gets trusted.

So recording is part of doing the work, not a step after it. A turn that makes a call, changes state, or makes a doc wrong ends with the record written. Doing it in the same turn keeps it accurate. Doing it at the end of the session means rebuilding it from a chat that has already lost detail, and that is how the important parts go missing. It applies just as much when you are executing someone else's plan: the plan holds their calls, not the ones you make while building it.

After every write, end your reply with one line: `paper-trail: <what was recorded>`. It shows the user what landed and leaves a trail that survives compaction.

## What is worth recording

You decide, not the hook. The test: if this session ended now and a different harness restored from these files alone, what would it need to understand what happened, why, and what is still open? Record calls and their reasons, milestones, state that is half done, work found and not yet started, and docs that became false. Do not record small edits: a typo, a formatting pass, a lockfile, a one-line fix inside work that is already recorded, or the individual steps of a build the plan already describes. One entry per decision or stage, not one per file. A busy session with a short record is normal. The store is a readable recent history: noise costs the owner in the viewer and the next agent in tokens.

## Records are written to be read by anyone

Treat every repo as public, read by strangers and possibly by a future employer, and private notes as likely to be shared too. Every record, shared or private, keeps a professional tone. The user may vent, swear or hold a controversial view in chat. The record keeps the substance in neutral wording, not the venting. No self-deprecation, no blame: a mistake is recorded as what happened, the fix and the rule that came out of it. Light humour and personality are fine where they read well to a stranger. Applies to plans, items, decisions, `CONTEXT.md`, `ARCHITECTURE.md` and code comments. Forward only: existing content is not re-audited.

## When this runs

Write in the same turn as the trigger, not at the end.

| Trigger | Destination | How |
|---|---|---|
| The user agrees to a call in chat (a tool, a provider, an approach, a rejection) | the active plan, or straight into the read-path doc the call changes. Not a decision file | section-surgical edit |
| While implementing, you make a call the plan didn't specify, or deviate from it | the plan's deviations section. With no plan, the read-path doc the call changes | section-surgical edit. Executing someone else's plan is not a reason to skip this: the plan records their calls, not yours |
| You start implementing a plan | one item for the plan, the plan's `Status:` line | `add` then `start`, edit `Status:` |
| Deployment, configuration, credentials handling or an external service changes | `ARCHITECTURE.md` or the folder's `CONTEXT.md` | section-surgical edit |
| An incident: a leak, data loss, a broken deploy | an item with the remediation steps, plus the rule that came out of it in `AGENTS.md` or `CONTEXT.md` | `add --file`, section-surgical edit |
| A piece of work starts, finishes, is parked or abandoned | the store, one item per piece of work | `start`, `done`, `park`, `drop`. Not one item per small change |
| New work is identified | the store | `find` first, then `add --file` with a body |
| A change makes a doc's statement false (an interface, a path, a constraint) | that doc | fix it before continuing the original task. A doc that is confidently wrong costs more than one that is absent |
| First real work in a folder with no context file | new `CONTEXT.md` there | from `assets/templates/CONTEXT.md`. Never bulk-generate across a tree |
| A chunk of work finishes, or `now` runs dry | suggest a flush, and consolidate over-granular items | `references/flush-prompt.md`. Judgement only |
| A plan is built (every deliverable done, or the user says so) | fold out, then close | write the fold-out, then `close-plan <file>` |
| A decision file is warranted (a footnote to a read-path rule whose reasoning would bloat that doc and is likely to be asked about again) | `plans/archived-decisions/` | `new-decision`, and link it from the doc it explains |

Untouched across sessions is the steady state. A quiet store is fine; a busy session with a quiet store is not.

## Items carry a body

An item is the handoff marker for the next session, not a to-do line, and not a copy of the plan. One item per implementation bubble, edited over its life. Done items say what was achieved at the level a returning reader cares about, not which files changed. Consolidating over-granular items is normal cleanup: merge siblings into one item whose body lists what they covered, drop the rest.

Anything that isn't obvious from its title gets a body: why it exists, what state it's in, the next concrete step, and pointers to files and plans. Title-only is for items whose title says everything. `add` and `edit` print a note when the body is empty.

Write the payload as a markdown file and pass it with `add --file item.md` (or `edit <id> --file item.md`). Frontmatter is optional (`status`, placement), the `# ` line is the title, and everything below it is the body. No quoting or indentation rules apply:

```markdown
---
status: parked
---
# Rotate the leaked triage token

Leaked in commit history on 24-09-2026 (decision 002). Redaction in `triage.js` stops new leaks but cannot un-leak this one, so rotation is the real fix.

Next: revoke in GitHub settings, create a fine-grained token, update the secret, re-run the workflow.
Blocked on: ko2q Push the redacted history.
```

`--file` works in every shell. `add -` reads the same from stdin. YAML payloads (`title:`, `body: |`) still work.

## Routing

Top to bottom, first match wins.

| Ask | Destination |
|---|---|
| Folder-local context for code, needed by whoever works in that folder? | `CONTEXT.md` in that folder |
| A call made while planning or building a feature? | that plan, `plans/YYYY-MM-DD-topic.md` (`new-plan`). Deviations go in its `Implementation deviations` |
| A call agreed in chat outside a plan? | the read-path doc it changes. Never a decision file by default |
| Reasoning behind a read-path rule that would bloat that doc and is likely to be asked about again? | `plans/archived-decisions/NNN-slug.md` (`new-decision`), linked from the doc via its `Linked from:` line. Never for something a plan, item or deviation already covers, never for normal implementation |
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

Run it from inside the target repo — it finds the root with `git rev-parse --show-toplevel`, else by walking up to a folder with `_architecture/`, so running it from the skill folder writes to the wrong place. `--root <path>` overrides. Paths are handled with Node's `path`, so the script runs the same on Windows and Unix. Before running any command below, replace `<skill dir>` with the absolute path of the folder holding this SKILL.md. The install location varies: global folder, repo, or plugin cache.

```
node <skill dir>/scripts/jookoi-paper-trail.js <command> [args] [--root <path>] [--private] [--dry-run]

list [--status=S] [--stale=N]      now items + 3 latest done; or one status
list --archived [--last N]          flushed items, newest first
find "<text>"  show <id>  count    search everything, one item (archived too), counts
add --title "<t>" | add - | add --file F   payload: markdown (# Title, body) or YAML
    [--after=ID|--before=ID|--first|--last]
done|park|start|drop <id>          status changes
edit <id> --title "<t>" | - | --file F   move <id> <placement>
flush [--before=DATE]              done+dropped -> archived-items/items-YYYY-MM.yaml
render                             store as markdown, for a human
stale [days]  check                stale items and context files; validate
sweep [--ack "<reason>"]           uncommitted work vs store and context files
nudge --session <id> [--start]     once-per-session end-of-turn reminder (hooks only)
hooks [--print [--harness=H]]      which hooks are wired; --print: fragment to merge
new-plan "<topic>"                 new plan, Status: draft
close-plan <file>                  Status: done, move to plans/archived-plans/
new-decision "<title>"             plans/archived-decisions/NNN-slug.md
```

Item format, IDs, placement and errors: `references/store-format.md`. A repo still on an older layout (`items.json`, `TODO.md`, `BACKLOG.md`, `plans/decisions/`, `plans/decision-history/`, `plans/implemented/`, `archive/`): `references/legacy-migration.md`. The script reads both old and new locations and writes only the new ones.

It owns IDs, dating, priorities, archiving, plan closing, `NNN` allocation, and template instantiation. It refuses rather than guesses: an unknown ID or malformed store is reported and nothing is written.

No Node available? `references/pipeline.md` has the manual fallback.

## Hard rules

- **Never show a bare ID to the user.** Every mention of an item, in a reply, a plan, a doc or another item's body, is `id title`, for example "k4f9 Migrate the store to YAML". The user cannot act on "start k4f9" without cross-referencing.
- **Never regenerate a prose file to change one section.** Target the heading, rewrite to the next one, leave every other byte alone.
- **Never write a secret.** API key, token, credential, connection string: flag it, don't record it. This covers item bodies and command output too. Don't print any part of a secret, not even a prefix.
- **Never leave a placeholder.** `TBD` / `TODO` / `[...]` — fill it or drop the section.
- **Never restate what the code shows**, document parameters, log a changelog, or explain framework behaviour. If removing a line wouldn't slow a newcomer down, cut it.
- **Never duplicate across levels.** Keep content at the more specific level; delete the copy.
- **Never carry a wiped name forward.** Once something is removed or rejected, live docs stop naming it. Full rule: `references/file-formats.md`.
- **A folder's `CONTEXT.md` dies with the folder** — but check inbound references and promote anything durable first (`references/operations.md`).

## Session start, hooks, compaction

- **Session start:** `list` (`now` items plus the 3 latest done), then `sweep`. `list --status=parked` when `now` is thin.
- **Hooks** run at session boundaries, where the harness supports them: `SessionStart` shows the working set and surfaces unrecorded work and finished plans from the previous session, `PreCompact` and `SessionEnd` preserve raw notes. One end-of-turn reminder fires at most once per session, only when this session left a lot unrecorded or an open plan looks finished. Treat it as a reminder: record what matters, or finish if nothing needs recording. If `sweep` reports hooks missing or unsupported, tell the user and ask before wiring anything; follow `references/hooks.md` only on a yes. Without them, `list` and `sweep` at session start are on you.
- **Compaction:** if you write the summary, keep a line saying jookoi-paper-trail is active in this repo and must be reloaded before the next write.

## Bundled assets

| Load when | File |
|---|---|
| Writing or validating a prose file (CONTEXT, plan, decision) | `references/file-formats.md` |
| How long, how detailed, what tone: worked examples of an item, plan, decision and CONTEXT.md | `references/examples.md` |
| Item fields, commands, placement | `references/store-format.md` |
| Bringing a repo off the old layout | `references/legacy-migration.md` |
| Flushing | `references/flush-prompt.md` |
| Recovering a dead session, handling compaction | `references/pipeline.md` |
| Finding, removing, staleness, section-surgical edits | `references/operations.md` |
| `sweep` or `hooks` says hooks are missing, or wiring them on any harness | `references/hooks.md` |
| A browsable page over the store, one or many repos | `references/viewer.md` |
| Creating a file that doesn't exist yet | `assets/templates/<type>.md`. Headings are suggestions, not a checklist |
| Any mechanical operation | `scripts/jookoi-paper-trail.js` |
