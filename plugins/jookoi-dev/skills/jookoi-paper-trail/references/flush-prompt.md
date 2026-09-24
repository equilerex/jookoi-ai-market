# Flush prompt

Run this at a boundary: a chunk of work finished, `now` ran dry, or the user asks. The agent may suggest it, the user may trigger it. Both run these steps.

1. `count`, then `list --status=done` (add `--since=<date>` to bound it).
2. Classify each done item:
   - **Durable** (explains why the repo is shaped a certain way): promote the fact to `ARCHITECTURE.md` or the repo `AGENTS.md`, or record a call with alternatives in `plans/decision-history/`, before archiving. Flushed items are lookup-only, so unpromoted content is effectively gone.
   - **Superseded or reversed**: `drop` it if it was never finished, otherwise leave it done.
   - **Just history**: leave it.
3. Check `list` for `now` items that no longer belong: `park` dormant ones, `drop` abandoned ones (`list --stale=14` finds candidates).
4. `flush` (optionally `--before=<date>` to keep recent done items visible).
5. Report what was promoted, parked, dropped and archived, each as `id title`.
