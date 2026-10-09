# Flush prompt

Run this at a boundary: a chunk of work finished, `now` ran dry, or the user asks. The agent may suggest it, the user may trigger it. Both run these steps.

1. `count`, then `list --status=done` (add `--since=<date>` to bound it).
2. Classify each done item:
   - **Durable** (explains why the repo is shaped a certain way): promote the fact to `ARCHITECTURE.md`, `CONTEXT.md` or the repo `AGENTS.md` before archiving. Flushed items are lookup-only, so unpromoted content is effectively gone.
   - **Superseded or reversed**: `drop` it if it was never finished, otherwise leave it done.
   - **Just history**: leave it.
3. Consolidate over-granular items: merge siblings that describe one piece of work into one item whose body lists what they covered, and drop the rest (hand-editing `items.yaml` is fine, run `check` after).
4. Check `list` for `now` items that no longer belong: `park` dormant ones, `drop` abandoned ones (`list --stale=14` finds candidates).
5. `flush` (optionally `--before=<date>` to keep recent done items visible).
6. Report what was promoted, parked, dropped and archived, each as `id title`.
