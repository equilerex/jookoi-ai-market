# Examples

What good records look like: tone, length, how much context. Copy the density, not the headings. Every example is shorter than you would guess, and that is the point.

## Item: one per piece of work, edited over its life

Starting:

```markdown
# Implement CSV export for reports

Plan: `_architecture/plans/2026-10-02-csv-export.md`. Started, nothing built yet.
```

Mid-build, after an `edit`:

```markdown
# Implement CSV export for reports

Plan: `_architecture/plans/2026-10-02-csv-export.md`. Export endpoint and streaming done. Next: the download button, then fold-out.
```

Done:

```markdown
# Implement CSV export for reports

Shipped: streamed CSV export from the reports page. Plan moved to `plans/archived-plans/2026-10-02-csv-export.md`.
```

Not this: five items for "Add export endpoint", "Add CSV writer", "Fix header row", "Add button", "Update README". That is a commit log, and git already keeps one.

## Plan: small feature

```markdown
# CSV export for reports

Session: 02-10-2026 14:10. Status: in progress.

## Context

Users copy report tables into spreadsheets by hand. Large reports time out when rendered as a table, so the export has to stream.

## Approach

Stream rows from the existing report query straight into the response. No temp files. Reuse the report filters, so the export matches what is on screen.

## Deliverables

- [x] `/reports/:id/export.csv` endpoint, streamed
- [ ] Download button on the report page

## Fold-out

- Streaming constraint → `api/reports/CONTEXT.md`

## Implementation deviations

- Kept the semicolon delimiter option out. Nobody asked, and Excel's locale handling made it fiddly.
```

A plan for a one-day change can be this short. A large one grows more design sections. Neither needs every heading.

## Decision: a footnote, rarely needed

```markdown
# Decision 007 — Reports stream instead of paginating

Date: 02-10-2026 15:30

Status: DECIDED

Linked from: `api/reports/CONTEXT.md`

## Problem

Exports over 50k rows hit the 30 s gateway timeout.

## Decision

Stream rows as the query yields them. Memory stays flat and the first byte arrives in under a second.

## Why not the alternatives

Pagination would need a job queue and a "your export is ready" email, which is a lot of moving parts for a download button.
```

Most calls never need one: the plan or the read-path doc holds them.

## CONTEXT.md

```markdown
# CONTEXT — api/reports
updated: 02-10-2026 16:05

## Gotchas

Exports stream. Do not buffer rows into an array "to sort them first": that brings back the timeout. Sort in the query (decision 007).
```

One heading was enough. The others were left out because nothing belonged in them.

## Tone

Plain, specific, neutral. A stranger, or a future employer, reading any of the above should find nothing to wince at. Light personality is fine ("fiddly"). Venting, blame and self-deprecation are not: "we wasted a day on Excel's broken locale garbage" becomes "Excel's locale handling made it fiddly".
