# Pipeline — flush

One stage, one direction:

```
TODO.md  ──flush──▶  archive/YYYY-MM.md
live working set        human-facing record
                        + archive/index.md pointer
   │
   └── still relevant, not yet flushed ──▶ BACKLOG.md (model moves it there first)
```

Entry grammar (`references/file-formats.md`) is the same one used everywhere dated entries appear, but there is now only one place they land: `archive/`.

---

## Flush

`jookoi-paper-trail flush --title "<t>"`. Runs on model judgement only — a chunk of work finished, or the checklist ran dry. Never on a cadence, never forced by a per-turn or per-session gate.

**Script-owned steps** — no model judgement, no model call:

1. **Read** `_architecture/TODO.md`. Refuse if `## Context` or `## Checklist` is missing.
2. **Take** the whole file — Context and Checklist both — as the entry body, verbatim.
3. **Insert** into `archive/<this-month>.md` as `## YYYY-MM-DD — <title>`. If an entry with that exact date and title already exists — a second flush the same day under the same title — append to it rather than creating a second one.
4. **Update** `archive/index.md`'s pointer for that month.
5. **Reset** `TODO.md` to its template: empty Context, empty Checklist.
6. **Report** what it wrote and where.

**Model-owned step — before calling flush, not after:**

7. **Move anything still relevant to `BACKLOG.md`.** The script does not read checkbox state or try to separate done from pending — it archives the whole file and wipes it. If a checklist item is still live, unfinished work that should not vanish, it goes to `BACKLOG.md` first, either item by item or as a short resume note, whichever fits. Once `flush` runs, whatever wasn't moved is only in `archive/` — a file the AI does not read back by default.

There is no step after flush. `TODO.md` starts clean; the next Context header and checklist get written the next time the model has something worth recording.

**Session marker.** On success, flush writes `_jookoi-architecture/.jookoi-paper-trail-ran-<session_id>`. It is not committed and is cleared by the next `SessionStart`. Its only remaining consumer is `jookoi-paper-trail status`; nothing gates on it demanding a flush.

---

## Recovery — a session that died mid-work

There is nothing special to recover. `TODO.md` persists indefinitely by design — a session that ends, crashes, or gets compacted without flushing leaves `TODO.md` exactly as it was, and the next session just keeps reading and editing the same file. There is no "unflushed log" state to reconcile and no old-dates-vs-today question, because nothing was supposed to be cleared in the first place.

`_jookoi-architecture/session-log.md`, written by the `PreCompact` hook, is a separate and coarser record: timestamps, branch, and `git status --short`. It exists for the rarer case where the transcript itself had context that never made it into `TODO.md` at all. Drain it by reading it, folding anything still relevant into `TODO.md`, then clearing it.

---

## Compaction

`PreCompact` receives the full uncompacted transcript on stdin and writes to disk; it cannot inject context back. `SessionStart` with a `compact` source matcher fires after the context shrinks and can inject. The pair is what survives compaction:

- **Before**: preserve anything from the transcript that hasn't reached `TODO.md`, to `_jookoi-architecture/session-log.md`.
- **After**: re-inject `TODO.md` verbatim — Context and Checklist both.

`TODO.md` is a separate file, not folded into `archive/`, because it's the thing read back in after context is lost. See `references/hooks.md` for the per-harness event names.

---

## Without Node

Every rule above is specified in `references/file-formats.md`, so this is executable by hand in a harness with no Node:

1. Take the whole of `TODO.md` and append it as `## YYYY-MM-DD — <title>` to the right `archive/YYYY-MM.md`, creating the file from `assets/templates/archive-month.md` if absent.
2. Update `archive/index.md`'s pointer for that month.
3. Reset `TODO.md` to its template.

Before step 1: check nothing in the checklist still needs to survive as live work. If it does, copy it to `BACKLOG.md` first — flush does not preserve it.
