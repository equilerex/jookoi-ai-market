# Pipeline — flush, recovery, compaction

```
items.yaml  ──flush──▶  archive/items-YYYY-MM.yaml
now / parked / done / dropped     done and dropped items only
```

Nothing live moves. `now` and `parked` items stay in `items.yaml` through a flush, so there is no "move it somewhere first" step.

## Flush

`jookoi-paper-trail flush [--before=<date>]`. Runs on judgement at a natural boundary (a chunk of work finished, `now` ran dry, or the user asks), never on a cadence and never forced by a hook. Deferring it costs nothing: `list` already excludes old `done` items.

Script-owned:

1. Select `done` and `dropped` items (only those finished before `--before` if given).
2. Append them to `archive/items-<month of ts_done>.yaml`, keyed by ID. An ID already in any archive file is refused.
3. Remove them from `items.yaml` and set `last_flush`.

Model-owned, before calling flush: the classification step in `references/flush-prompt.md`. Durable content in a done item is promoted to `ARCHITECTURE.md` or `plans/decision-history/` first, since the archive is not read back by default.

The older `archive/YYYY-MM.md` files are history from the previous format. They are searched by `find` and never written again.

## Recovery — a session that died mid-work

Nothing to recover. `items.yaml` persists exactly as the last write left it, and every write is one atomic command, so a crash between commands loses nothing already recorded.

`_jookoi-architecture/session-log.md`, written by the `PreCompact` hook, is a coarser record: timestamps, branch, `git status --short`. It exists for the case where the transcript held context that never reached the store. Drain it by reading it, folding anything still relevant into the store, then clearing it.

## Compaction

`PreCompact` receives the uncompacted transcript on stdin and writes to disk; it cannot inject context back. `SessionStart` with a `compact` matcher fires after the context shrinks and can inject.

- **Before**: preserve anything not yet recorded to `_jookoi-architecture/session-log.md`.
- **After**: re-inject the `list` output.

See `references/hooks.md` for the per-harness event names.

## Without Node

`items.yaml` is plain YAML with a schema in `references/store-format.md`. By hand: edit the item, pick a new random ID that starts with a letter and contains a digit and appears in no archive file, set `ts_touched`. Move finished items into the month's archive file. Do this only when Node is genuinely unavailable.
