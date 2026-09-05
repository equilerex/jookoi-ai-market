# File formats — canonical spec

Every rule here is enforced by `scripts/jookoi-paper-trail.js`. This document is the specification the script implements and the fallback when Node is unavailable.

Paths are given for the shared layer. The private layer is identical with the `_jookoi-` prefix: `_jookoi-architecture/`, `_jookoi-CONTEXT.md`. Both layers may exist side by side.

---

## Universal rules

**Entry grammar.** Every dated entry, in every file that has them:

```markdown
## YYYY-MM-DD — Title
```

Em dash `—`, spaced. Title is a sentence fragment, no trailing period. Body follows after one blank line: prose paragraphs, optional bullets. No other heading level is used for entries; `###` is permitted inside an entry body.

This grammar is identical in `archive/YYYY-MM.md`, the sole place dated entries land. That is what makes flush a mechanical append.

**Ordering.** Newest first in every dated file.

**Policy comment.** Line 2 of every managed file is an HTML comment stating what the file is and who maintains it. It is the only thing a cold agent has to identify the file from its contents alone.

**Dates.** `YYYY-MM-DD`, always. Never relative ("yesterday", "last session"). The script supplies the date; never hand-write one.

**Line width.** No hard wrap. One paragraph is one line.

**Duplicate detection.** An entry whose body matches an existing entry in the same file at ≥95% is rejected, not appended.

**Wiped names.** Once something is removed or rejected, live docs stop naming it. The decision record holds the name and the reasoning, and that is where a reader goes. Name it outside that record only when the reader has to act on it: they might still have it installed, they will hit it in someone else's setup, or the reason it failed is a rule that now binds other choices. "We considered X" is not a lesson.

---

## `_architecture/TODO.md`

The live working set. Two blocks with different behaviours; both always present.

```markdown
# TODO
<!-- Live working set. `jookoi-paper-trail flush` archives it and resets it. See AGENTS.md. -->

## Context

Where things stand right now and why. Rewritten in place, never appended to.

## Checklist

- [ ] An open item.
- [x] A finished item, left in place until flush.
```

**Context** — rewritten wholesale, in present tense, whenever it goes stale. Answers "what does a cold session need to know to not re-derive it". Short — a handful of lines, not a running log. Never dated, never accumulates, never contains a history of its own prior states.

**Checklist** — `- [ ]` / `- [x]`, hand-maintained directly with a normal edit, the same way `Context` always was. Mixes done, in-progress and pending items on purpose. Persists across sessions untouched — there is no per-session or per-turn obligation to clear it. It empties only when `flush` runs, and only after anything still relevant has been moved to `BACKLOG.md` first.

**Cap:** none. Nothing rolls off on its own; it lives until a flush.

**Does not go in:** finished-work history once it has actually been archived (that is `archive/`, reached by flush); anything that belongs to one folder (`CONTEXT.md`).

---

## `_architecture/archive/YYYY-MM.md`

Flushed `TODO.md` snapshots. Written only by `flush`. Human-facing record, not a working file — an AI reads it only when history is explicitly requested or genuinely needed, never by default.

```markdown
# Archive — YYYY-MM
<!-- Written by `jookoi-paper-trail flush`. Do not read unless history is explicitly requested. See AGENTS.md. -->

## YYYY-MM-DD — Title

Whatever TODO.md held at flush time: its Context and Checklist, verbatim.
```

The month in the filename is the month the flush ran. A flush on the same date and title as an existing entry appends to it rather than creating a second one.

**Cap:** none.

**Does not go in:** anything not reached via `flush`.

---

## `_architecture/archive/index.md`

Readable without opening any archived file.

```markdown
# Archive index
<!-- Readable without opening archived files. jookoi-paper-trail maintains this. See AGENTS.md. -->

- **`YYYY-MM.md`** — YYYY-MM-DD to YYYY-MM-DD: one-line summary of what the file covers.
```

One pointer per archive file, newest first. The date range is the span of entries actually in that file, recomputed on every rotation.

**Does not go in:** prose outside the pointer list. Rotation status is `jookoi-paper-trail status`, not a sentence here.

---

## `_architecture/BACKLOG.md`

Logged, not yet scoped or sequenced.

```markdown
# Backlog — logged, not yet scoped
<!-- Deliberately unordered. Pull an item into TODO.md's checklist when it gets a real slot. See AGENTS.md. -->

## Item title

Status: OPEN

Body.
```

`Status:` is one token from a closed set, on its own line under the heading:

| Token | Means |
|---|---|
| `OPEN` | Logged, nothing decided |
| `DESIGNED` | Design settled, not built |
| `BLOCKED` | Waiting on something named in the body |
| `MOVED` | Now lives elsewhere; body says where |
| `DROPPED` | Deliberately not doing it; body says why |

Headings are topic titles, undated and unnumbered. Status never appears in the heading.

**Does not go in:** work already picked up (`TODO.md`'s checklist); anything already started.

---

## `_architecture/plans/YYYY-MM-DD-topic.md`

One file per planning session. Kept permanently, never capped, never archived.

```markdown
# Title

Session: YYYY-MM-DD. Status: <one line>.

## Context
## <the design, in whatever sections it needs>
## Build order
## Implementation deviations
```

Only `Context` and the `Session:` line are required. `Implementation deviations` is added when the build diverges from what the plan said, and is the section future reads reconcile against.

**Does not go in:** running status (that drifts — it belongs in `TODO.md`); anything that will need editing as work proceeds, other than the deviations section.

---

## `_architecture/plans/decisions/NNN-slug.md`

One call, with its reasoning. `NNN` is zero-padded, allocated by `jookoi-paper-trail new-decision`, never reused.

```markdown
# Decision NNN — Title

Date: YYYY-MM-DD

Status: DECIDED

## Problem
## Options considered
## Decision
## Why not the alternatives
## Next step
```

All five sections are required. `Status:` is one token from: `DECIDED`, `TRIAL`, `REJECTED`, `DEFERRED`, `SUPERSEDED`. A superseding decision gets its own number; the superseded file's status changes and its body gains a pointer — it is never edited away or deleted.

**Does not go in:** decisions still being made (they are not decisions yet); implementation detail.

---

## `CONTEXT.md` (any folder)

Feature-level context, at feature-area and component-folder granularity.

```markdown
# CONTEXT — folder-or-feature-name
updated: YYYY-MM-DD

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
- An entry heading does not parse as `## YYYY-MM-DD — Title`.
- `TODO.md` is missing either the `## Context` or `## Checklist` heading.
- A `Status:` value is outside its file's closed vocabulary.
- A `CONTEXT.md` lacks any of its four sections.

A refusal names the file, the line, and what was expected. It never rewrites the file to fix it — that is the model's call, since a malformed file usually means content was placed by hand for a reason.
