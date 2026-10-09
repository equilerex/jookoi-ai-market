# File formats — canonical spec

Rules enforced by `scripts/jookoi-paper-trail.js`. Item storage is specified separately in `references/store-format.md`.

Paths are given for the shared layer. The private layer is identical with the `_jookoi-` prefix: `_jookoi-architecture/`, `_jookoi-CONTEXT.md`. Both layers may exist side by side.

---

## Universal rules

**Policy comment.** Line 2 of every managed file is an HTML comment stating what the file is and who maintains it. It is the only thing a cold agent has to identify the file from its contents alone.

**Dates and timestamps.** Two formats, by where they sit:
- **Filenames and keys** (`plans/YYYY-MM-DD-topic.md`, `archived-items/items-YYYY-MM.yaml`, `--before=`/`--since=` flags): `YYYY-MM-DD`, always — sorts correctly as plain text.
- **Prose content** (`Date:`, `Session:`, `updated:`, and `items.yaml`'s `ts_*` fields): a full timestamp, not a bare date — same-day entries need ordering. In MD prose, European order: `DD-MM-YYYY HH:MM`, local time. In `items.yaml`, full ISO 8601 UTC (`references/store-format.md`).

Never relative ("yesterday", "last session"). The script supplies every date and timestamp; never hand-write one.

**Line width.** No hard wrap. One paragraph is one line.

**Tone.** Every record, shared or private, is professional and neutral, with no blame and no self-deprecation. A mistake is recorded as what happened, the fix and the rule that came out of it. Forward only.

**Wiped names.** Once something is removed or rejected, live docs stop naming it. Name it only when the reader has to act on it: they might still have it installed, they will hit it in someone else's setup, or the reason it failed is a rule that now binds other choices. "We considered X" is not a lesson.

---

## `_architecture/items.yaml` and `archived-items/items-YYYY-MM.yaml`

The working-set store and its monthly archive. Normally script-written, hand-editing allowed for cleanup (run `check` after). Full spec: `references/store-format.md`. Archive files are not read unless history is asked for. `find`, `show` and `list --archived --last N` reach them. Older repos may still have `archive/`, which the script also reads.

---

## `_architecture/plans/YYYY-MM-DD-topic.md`

One file per feature or design question. Created by `new-plan` at the start of planning, drafted in the file.

```markdown
# Title

Session: DD-MM-YYYY HH:MM. Status: draft.

## Context
## <the design, in whatever sections it needs>
## Deliverables
## Fold-out
## Implementation deviations
```

Only the `Session:` line is required. The headings are a starting point: keep what the plan needs, drop the rest, add others. Examples of the expected length and tone: `references/examples.md`. `Status:` runs draft, ready, in progress, done by convention, not enforced. `Deliverables` holds progress (ticks, notes), updated in bulk. `Fold-out` names each durable outcome and the read-path doc it goes to (`ARCHITECTURE.md`, `CONTEXT.md`, `AGENTS.md`, `README.md`). `none: <reason>` is valid. `Implementation deviations` records calls the plan did not cover and is what future reads reconcile against.

`plans/` holds plans only. Handoff notes, research, generated files and mocks go elsewhere (SKILL.md, "Lifecycle of feature work").

**Closing.** `close-plan <file>` sets `Status: done` and moves the file to `plans/archived-plans/` with no other edit. It warns when `Fold-out` is missing or empty. An archived plan is read only when a doc, an item or the user names it. Older repos may still have `plans/implemented/`, which the script also reads.

---

## `_architecture/plans/archived-decisions/NNN-slug.md`

A footnote to a rule in a read-path doc: reasoning that would bloat that doc and is likely to be asked about again. It is not a rule, and it is not for anything a plan, an item or a deviation already covers. A call agreed in chat goes into the active plan or straight into the read-path doc it changes. Agents do not read this folder unprompted: open a file only when a doc links it or the user asks why.

`NNN` is zero-padded, allocated by `jookoi-paper-trail new-decision`, never reused. There is no index file. The doc whose rule the decision explains links to it, and the file names that doc on its `Linked from:` line. `check` flags decision files that no read-path doc links. A decision whose content is already stated in `ARCHITECTURE.md` or `AGENTS.md` is folded in and its file deleted, with inbound links repointed. Older repos may still have `plans/decision-history/`, which the script also reads.

```markdown
# Decision NNN — Title

Date: DD-MM-YYYY HH:MM

Status: DECIDED

Linked from: <read-path doc>

## Problem
## Decision
## Why not the alternatives
```

Headings are suggestions. Write what a reader asking "why?" needs, nothing more. `check` only expects the `Linked from:` line. `Status:` is one token from: `DECIDED`, `TRIAL`, `REJECTED`, `DEFERRED`, `SUPERSEDED`. A superseding decision gets its own number. The superseded file's status changes and its body gains a pointer.

**Does not go in:** decisions still being made (they are not decisions yet), implementation detail.

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

Headings are suggestions. Use the ones that have something in them, drop the rest: a `CONTEXT.md` with only a `Gotchas` section is normal. `updated:` is bumped by the script on every write.

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

A refusal names the file, the line, and what was expected. It never rewrites the file to fix it — that is the model's call, since a malformed file usually means content was placed by hand for a reason.
