# Working-set store

The live working set is `_architecture/items.yaml` (private layer: `_jookoi-architecture/items.yaml`). `scripts/jookoi-paper-trail.js` is the only writer: never hand-edit the file, never regenerate it.

```
_architecture/
  items.yaml                    active set: now, parked, and done or dropped items not yet flushed
  archive/items-YYYY-MM.yaml    flushed items, one file per month of ts_done
```

Root resolution: `--root <path>`, else `git rev-parse --show-toplevel`, else walk up from cwd to a folder holding `_architecture/` or `_jookoi-architecture/`. `--private` picks the private layer.

## Schema

```yaml
repo: stack
last_flush: 2026-09-19T08:00:00Z
items:
  k4f9:
    title: Rewrite flush so it stops wiping the file
    status: now            # now | parked | done | dropped
    priority: 2000
    body: |
      Free-form markdown. Quotes, "double" and 'single', need no escaping.

      - live items no longer move
    ts_created: 2026-09-12T09:04:11Z
    ts_started: 2026-09-14T13:22:00Z
    ts_done: null
    ts_touched: 2026-09-19T17:41:58Z
```

- `repo` is the ID prefix for cross-repo references and exports (`stack:k4f9`). It is written once when the file is created, defaulting to the repo root's folder name lowercased, and never derived again.
- `title` is one line, shown by `list`. `body` is markdown, shown by `show`: why the item exists, its state, the next step, pointers. Leave it empty only when the title says everything. `list` marks `now` and `parked` items that have none, and `add`/`edit` print a note.
- `status` is `now`, `parked`, `done` or `dropped`. `parked` covers both never-scoped and gone-dormant items; `ts_started` tells them apart. `dropped` is a decision not to do it.
- `priority` is a sparse number, lower sorts first. New items append at `max + 1000`. A placement between two items averages their values. Nothing renumbers, and an item keeps its value across status changes. Ordering is approximate by design.
- Timestamps (`ts_*`, `last_flush`) are full ISO 8601 UTC (`2026-09-19T17:41:58Z`), not bare dates, since same-day writes need ordering. Every write sets `ts_touched`.
- IDs are short random base36 strings, no counter, checked for collisions against the active file and every archive file. An ID starts with a letter and contains a digit, so YAML never reads it as a number, boolean or null. IDs are never reused, since plan files cite them. Older `t001`-style IDs stay valid. Input accepts the bare ID, `repo:id`, and the legacy `t17` and `t017` forms. A prefix that does not match `repo:` is refused with the repo it belongs to.

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
| `list --archived [--last N]` | Flushed items, newest first, default 10. Bounded on purpose |
| `find "<text>"` | Matches across every status, the YAML archives and the older markdown archive. Run before `add` |
| `show <id>` | Full item and timestamps. Resolves archived IDs too |
| `count` | Counts per status, archived total, last flush date |
| `render [--status=S]` | The store as markdown, IDs carry the repo prefix |

`list` prints one line per item, ID then title, no priority integer and no body. A `now` or `parked` item with an empty body is marked:

```
- [ ] k4f9 Walk-up root resolution for non-git folders
- [ ] p2q7 Check the phone shortcut  (no body)
- [x] t015 Global AGENTS.md gained a Naming section
```

Session checks, read-only apart from `--ack`:

| Command | Returns |
|---|---|
| `sweep` | Uncommitted files newer than the last store write, `CONTEXT.md` files older than changes under them, changed folders with no context file, items with no body, missing hooks for this harness, or a note that the harness has none |
| `sweep --ack "<reason>"` | Records why the remaining changes need no record, which quiets the gate until files change again. Refuses without a reason. Run it after recording, never before |
| `sweep --gate` | Used by `doc-gate.sh`: prints only when the gate should block |
| `hooks` | Per harness, whether the gate, rehydrate and preserve hooks are wired, and where |
| `hooks --print [--harness=H]` | The hooks fragment for this harness (or `H`: `claude`, `gemini`, `copilot`) with this install's paths, and the file it merges into |

Every message that names an item prints `id title`. When you refer to an item in a reply, do the same: the user cannot act on a bare ID.

Writes, each a single call with no prior read:

| Command | Effect |
|---|---|
| `add --title "<t>"` | Title-only item. Default status `now`, appended last, prints `id title` |
| `add -` / `add --file F` | Payload from stdin or a file |
| `done <id>` / `park <id>` / `start <id>` / `drop <id>` | Status change. `done` sets `ts_done`, `start` sets `ts_started` if unset |
| `edit <id> --title "<t>"` / `edit <id> -` / `edit <id> --file F` | Replaces the payload keys given (`title`, `body`) |
| `move <id> <placement>` | Reprioritise |
| `flush [--before=<date>]` | Moves `done` and `dropped` items to `archive/items-YYYY-MM.yaml` by month of `ts_done`. Touches nothing else. Refuses on an ID collision |

The payload is markdown or YAML. Use `--file` under PowerShell, where heredocs differ.

Markdown is the default choice: a `.md` file, or stdin whose first line (after any frontmatter) is `# ` and has no `title:` key. Frontmatter holds `status`, `priority` and placement keys. The `# ` line is the title, and the text below it is the body, copied as written:

```markdown
---
status: parked
after: k4f9
---
# Rewrite flush so it stops wiping the file

Free-form markdown, copied in as written.
```

YAML (JSON is valid YAML) uses the keys `title`, `body`, `status` and placement keys. Quote a title that contains `: `, and indent the body two spaces under `body: |`. A malformed payload is refused with these rules in the message.

Placement is `--after=<id>`, `--before=<id>`, `--first` or `--last` (default). Name a neighbour already seen in `list`; the script computes the number. `--priority=<n>` exists for scripting only.

Archived items are read-only: `show` and `find` resolve them, every write command refuses them.

## Errors

An unknown ID exits non-zero naming the ID, never a silent no-op. A malformed store is reported and left untouched. Every write compares the file against what it read and refuses on a mismatch (a concurrent writer) instead of merging.

## Flush

`flush` is non-destructive: it only moves finished items, so nothing live is at risk and there is no move-to-backlog step. Unflushed items load into every session's context. Flushed items are lookup-only: `find`, `show <id>` and `list --archived --last N`. Flush at a stable point after which older items are unlikely to matter next session, and follow `flush-prompt.md`, so the classification step runs the same way each time.
