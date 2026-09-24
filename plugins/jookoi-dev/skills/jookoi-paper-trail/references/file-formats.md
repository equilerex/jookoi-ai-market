# File formats — canonical spec

Rules enforced by `scripts/jookoi-paper-trail.js`. Item storage is specified separately in `references/store-format.md`.

Paths are given for the shared layer. The private layer is identical with the `_jookoi-` prefix: `_jookoi-architecture/`, `_jookoi-CONTEXT.md`. Both layers may exist side by side.

---

## Universal rules

**Policy comment.** Line 2 of every managed file is an HTML comment stating what the file is and who maintains it. It is the only thing a cold agent has to identify the file from its contents alone.

**Dates and timestamps.** Two formats, by where they sit:
- **Filenames and keys** (`plans/YYYY-MM-DD-topic.md`, `archive/items-YYYY-MM.yaml`, `--before=`/`--since=` flags): `YYYY-MM-DD`, always — sorts correctly as plain text.
- **Prose content** (`Date:`, `Session:`, `updated:`, and `items.yaml`'s `ts_*` fields): a full timestamp, not a bare date — same-day entries need ordering. In MD prose, European order: `DD-MM-YYYY HH:MM`, local time. In `items.yaml`, full ISO 8601 UTC (`references/store-format.md`).

Never relative ("yesterday", "last session"). The script supplies every date and timestamp; never hand-write one.

**Line width.** No hard wrap. One paragraph is one line.

**Wiped names.** Once something is removed or rejected, live docs stop naming it. `plans/decision-history/` holds the name and the reasoning, and that is where a reader goes. Name it outside that folder only when the reader has to act on it: they might still have it installed, they will hit it in someone else's setup, or the reason it failed is a rule that now binds other choices. "We considered X" is not a lesson.

---

## `_architecture/items.yaml` and `archive/items-YYYY-MM.yaml`

The working-set store and its monthly archive. Script-written only. Full spec: `references/store-format.md`. Archive files are not read unless history is asked for; `find`, `show` and `list --archived --last N` reach them.

---

## `_architecture/plans/YYYY-MM-DD-topic.md`

One file per planning session. Kept permanently, never capped, never deleted.

```markdown
# Title

Session: DD-MM-YYYY HH:MM. Status: <one line>.

## Context
## <the design, in whatever sections it needs>
## Build order
## Implementation deviations
```

Only `Context` and the `Session:` line are required. `Implementation deviations` is added when the build diverges from what the plan said, and is the section future reads reconcile against.

**Does not go in:** running status (that drifts — it belongs in the store); anything that will need editing as work proceeds, other than the deviations section.

**Once the build it describes is done**, move the file to `plans/implemented/YYYY-MM-DD-topic.md` — same name, same content, no rewrite. This is a plain move, not archiving: the file stays permanently and is still the record `Implementation deviations` reconciles against, it just stops sitting in the folder a cold session scans by default. `plans/` root is for plans still open or in flight; `plans/implemented/` is read only when a plan is named explicitly. Decision files (`plans/decision-history/`) don't move.

---

## `_architecture/plans/decision-history/NNN-slug.md`

Background on why a rule exists: one call made outside a planning session, with its reasoning. It is not a rule. The rule lives in `ARCHITECTURE.md`, `AGENTS.md` or `CONTEXT.md`. A call made inside a planning session is recorded in that plan, not in a separate file. Agents do not read this folder proactively: open a file only when a doc cites it or the user asks why.

`NNN` is zero-padded, allocated by `jookoi-paper-trail new-decision`, never reused. `new-decision` also appends a line to `index.md`, which holds one line per decision (`- [NNN Title](NNN-slug.md): what it explains`). `check` compares the index against the folder. A decision whose content is already stated in `ARCHITECTURE.md` or `AGENTS.md` is folded in and its file deleted, with inbound links repointed.

```markdown
# Decision NNN — Title

Date: DD-MM-YYYY HH:MM

Status: DECIDED

## Problem
## Options considered
## Decision
## Why not the alternatives
## Next step
```

All five sections are required. `Status:` is one token from: `DECIDED`, `TRIAL`, `REJECTED`, `DEFERRED`, `SUPERSEDED`. A superseding decision gets its own number; the superseded file's status changes and its body gains a pointer.

**Does not go in:** decisions still being made (they are not decisions yet); implementation detail.

---

## `CONTEXT.md` (any folder)

Feature-level context, at feature-area and component-folder granularity.

```markdown
# CONTEXT — folder-or-feature-name
updated: DD-MM-YYYY HH:MM

## What this is

Scope, one or two lines.

## Why it's built this way

Decisions that don't self-explain.

## Gotchas

Glitches, footguns, surprises.

## Don't

Tried and rejected.
```

All four sections stay even when briefly empty — their absence is indistinguishable from an omission. `updated:` is bumped by the script on every write.

**Created** the first time real work happens in the folder, by whoever does that work. **Never** bulk-generated across a tree.

**Does not go in:** anything the code plainly shows; API or parameter documentation (that belongs in code); changelog or commit history (git has it); general framework or language behaviour (the model has it). Test: if removing a line would not slow a newcomer down, cut it.

**Against `README.md`:** `README.md` addresses a human arriving at the folder. `CONTEXT.md` addresses an agent about to change code in it. Both may exist. Agent-facing content already in a `README.md` moves rather than being duplicated. Never create a `CONTEXT.md` beside a `README.md` merely to have one.

---

## `_architecture/ARCHITECTURE.md`

Why the repo is shaped this way. Static — changed only when structure, patterns, module boundaries or key decisions change.

No fixed section set, no cap, no dated entries. Deep-dive detail goes to a linked `<feature>.ARCHITECTURE.md` rather than inline.

**Does not go in:** anything that changes per session; tutorials; status.

---

## Refusal conditions

The script refuses and reports rather than guessing when:

- A managed file's line 1 heading does not match its expected title.
- `items.yaml` or an archive file is not valid YAML, or an item has a status outside `now | parked | done | dropped`.
- A `CONTEXT.md` lacks any of its four sections.

A refusal names the file, the line, and what was expected. It never rewrites the file to fix it — that is the model's call, since a malformed file usually means content was placed by hand for a reason.
