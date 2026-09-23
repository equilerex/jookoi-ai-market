# Working-set store

The live working set is `_architecture/items.json` (private layer: `_jookoi-architecture/items.json`). It replaces `TODO.md`'s checklist and `BACKLOG.md`. `scripts/jookoi-paper-trail.js` is the only writer: never hand-edit the file, never regenerate it.

```
_architecture/
  items.json                    live store: now, parked, done, dropped
  archive/items-YYYY-MM.json    flushed items, one file per month
  TODO.md                       only the `## Context` prose header
```

Root resolution: `--root <path>`, else `git rev-parse --show-toplevel`, else walk up from cwd to a folder holding `_architecture/` or `_jookoi-architecture/`. `--private` picks the private layer.

## Schema

```json
{
  "next_id": 19,
  "last_flush": "2026-09-19T08:00:00Z",
  "items": {
    "t017": {
      "content": ["Rewrite flush so it stops wiping the file", "", "- live items no longer move"],
      "status": "now",
      "priority": 2000,
      "ts_created": "2026-09-12T09:04:11Z",
      "ts_started": "2026-09-14T13:22:00Z",
      "ts_done": null,
      "ts_touched": "2026-09-19T17:41:58Z"
    }
  }
}
```

- `content` is markdown as an array of lines. Line 0 is the title shown by `list`, the rest is the body shown by `show`.
- `status` is `now`, `parked`, `done` or `dropped`. `parked` covers both never-scoped and gone-dormant items; `ts_started` tells them apart. `dropped` is a decision not to do it.
- `priority` is a sparse number, lower sorts first. New items append at `max + 1000`. A placement between two items averages their values. Nothing renumbers, and an item keeps its value across status changes. Ordering is approximate by design.
- Timestamps (`ts_*`, `last_flush`) are full ISO 8601 UTC (`2026-09-19T17:41:58Z`), not bare dates — same-day writes need ordering. Every write sets `ts_touched`. Items migrated from the old files have `null` for the timestamps that were never recorded.
- `next_id` only grows. IDs (`t017`) are never reused, including after a flush, because plan files cite them by name. Input accepts `t17`, `17` or `t017`.

## Commands

```
node ~/.agents/skills/jookoi-paper-trail/scripts/jookoi-paper-trail.js <command> [--root <path>] [--private] [--dry-run]
```

Reads:

| Command | Returns |
|---|---|
| `list` | `now` items in priority order plus the 3 most recent `done`. The default read, always bounded |
| `list --status=parked` | Items of one status in priority order |
| `list --status=done --since=<date>` | Done items in a window (flush classification) |
| `list --stale=<days>` | `now` items untouched for N days |
| `find "<text>"` | Matches across every status, the JSON archive and the older markdown archive. Run before `add` |
| `show <id>` | Full content and timestamps of one item |
| `count` | Counts per status, archived total, last flush date |
| `render [--status=S]` | The store as markdown, for a human |

`list` prints one line per item, ID inline, no priority integer and no body:

```
- [ ] `t018` Walk-up root resolution for non-git folders
- [x] `t015` Global AGENTS.md gained a Naming section
```

Writes, each a single call with no prior read:

| Command | Effect |
|---|---|
| `add "<markdown>" [--status=now\|parked] [placement]` | New item, prints its ID. Default `now`, appended last |
| `done <id>` / `park <id>` / `start <id>` / `drop <id>` | Status change. `done` sets `ts_done`, `start` sets `ts_started` if unset |
| `edit <id> "<markdown>"` | Replaces content |
| `move <id> <placement>` | Reprioritise |
| `flush [--before=<date>]` | Moves `done` and `dropped` items to `archive/items-YYYY-MM.json`. Touches nothing else |

Placement is `--after=<id>`, `--before=<id>`, `--first` or `--last` (default). Name a neighbour already seen in `list`; the script computes the number. `--priority=<n>` exists for scripting only.

## Errors

An unknown ID exits non-zero naming the ID, never a silent no-op. A malformed store is reported and left untouched. Every write compares the file against what it read and refuses on a mismatch (a concurrent writer) instead of merging.

## Flush

`flush` is non-destructive: it only moves finished items, so nothing live is at risk and there is no move-to-backlog step. Because `list` excludes old `done` items, a large `done` pile costs nothing, and flushing is tidying done on judgement, not urgency. Suggest it at a natural boundary (a chunk of work finished, or `now` ran dry) and follow `flush-prompt.md`, so the classification step runs the same way each time.
