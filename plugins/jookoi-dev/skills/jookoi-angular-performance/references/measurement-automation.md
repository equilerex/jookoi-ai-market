# Measurement automation

Setting up repeatable measurement, baselines and old-vs-new comparison. Work through it WITH the user: ask the questions, present options, and let them choose. Never install, configure, commit or schedule anything unprompted. Manual one-off measuring is in `measuring.md`, budgets and the stats file are in `build-and-deploy.md`. Facts were checked on 2026-09-21. Recipes marked untested were not run.

Core rule: an agent-run single audit is diagnostic. A regression verdict needs repeated runs in one environment, ideally CI.

## Ask first (only what is unresolved, offer concrete options)

1. Public or private repo, and which CI provider (GitHub Actions, GitLab, Azure, none)?
2. Where does it deploy (preview per PR, staging only, prod only, nothing) and can CI reach it?
3. Are the important routes behind login? Is a test account or token available?
4. Traffic level? Field data (RUM, CrUX) needs enough real visits per route.
5. Goal: one-off audit, PR regression gate, or long-term trend?
6. Is a hosted service or server allowed (data leaving, cost, ops capacity)?
7. Which 3 to 10 routes matter, and which device and network target?
8. May a baseline and results log be committed to the repo? Who reads results (developers, PMs, a channel)?

## Default proposal

When the user has no preference, propose this and change only what their answers differ on. It was built and worked in a real run (Angular 22.1.6, prerendered static site, 2026-09-21), locally rather than in CI:

- `lighthouse` as a pinned repo-local devDependency, run through the project's package manager, not `npx --yes` (that fetches a different version on each machine). Installing it needs the user's approval and the package-manager check in `SKILL.md`: `node_modules/.package-lock.json` means npm, `node_modules/.pnpm` means pnpm. Stop dev servers, install once, save the full output to a file, do not retry with another manager.
- Mobile emulation, median of 3 runs per URL locally (5 in CI, per the noise rules below). Report median and spread.
- One committed JSON per commit, for example `_architecture/perf-baselines/<short-sha>[-dirty].json`: commit, tool versions, per-page score, LCP, FCP, TBT, CLS, transfer bytes, plus bundle sizes read from `stats.json` (`scripts/route-cost.mjs --json` gives initial and per-route bytes).
- A `--compare <a> <b>` command that prints per-metric deltas.
- Targets versus regressions: absolute limits (for example LCP 2.5 s) print as targets and never fail. Only a regression against the committed baseline fails.
- Keep any CI Lighthouse step non-blocking until a baseline recorded on the CI runner is committed.

Ask about the choices that differ: where results are stored, whether CI runs it, which routes, whether the repo may hold baseline files.

## Traps (check before recording a baseline)

- **Check the preview server first.** A static server without compression, or one that serves the client-rendered fallback for `/route/` instead of `route/index.html`, made every metric about 2x worse in the run and hides real regressions. Verify with `curl -s -H "Accept-Encoding: br" -D - -o /dev/null <url>` for a `content-encoding` header, and compare the response byte count of a deep route against its prerendered file. Fix the server, then record.
- **Lighthouse on Windows** can exit non-zero with `EPERM` while deleting its temporary Chrome profile, after the report is written. If the report file exists and parses, treat it as success.
- **Runner mismatch.** A baseline recorded on a developer machine is not comparable with a CI runner. Record a baseline on the runner before making CI blocking.
- **Dirty baselines.** Record the commit hash and a `-dirty` marker when the tree has uncommitted changes, and tell the user to re-record after committing.
- **One run is noise.** In the run a single-run compare flagged a TBT regression (192 to 406 ms) that a 3-run median did not. Never draw a verdict from one run.

## Options and maintenance status

| Option | Measures | Status (npm and GitHub, 2026-09-21) | Notes |
|---|---|---|---|
| Lighthouse CLI | Lab metrics, node API, user flows | 13.5.0, active | Needs a reachable URL. Node API and flows are the scripting route |
| Lighthouse CI (`@lhci/cli`) | Lighthouse runs, assertions, upload | 0.15.1, last release 2025-06, bundles Lighthouse 12.6.1 | Scores differ from a current CLI, pin one and record it. Assertions are absolute thresholds per run |
| Unlighthouse | Site-wide crawl of Lighthouse | 0.18.0, Node 22.18+ | Good for finding the worst routes, weaker as a strict gate because sampling varies the route set |
| sitespeed.io | Browsertime runs, Grafana time series, scripted journeys | 42.7.0, active, Node 22+ | Self-hosted history and login scripting, heavier to operate |
| PageSpeed Insights API | Lab plus CrUX for a public URL | Google service | Public URLs only. Lab part also varies per run |
| Playwright with `web-vitals` or Lighthouse | Scripted login and route walking | Playwright 1.63.0 | Handing the browser to Lighthouse is an untested recipe |
| Chrome DevTools MCP | Traces, insights, network, emulation | `chrome-devtools-mcp` 1.9.0, very active | `lighthouse_audit` excludes performance, use the trace tools. No built-in diff |
| `@danielsogl/lighthouse-mcp` | Local Lighthouse audits, budget checks, mobile vs desktop | 2.0.1, community | No base-vs-head comparison |
| `web-vitals` (RUM) | Real-user LCP, INP, CLS with attribution | 6.2.2, active | Only real field source |
| CrUX API | 28-day p75 for origin or URL | Google service | Key required, 150 queries per minute per project, about 2 days behind. Low-traffic URLs have no data |
| `size-limit` | Bundle size gate | 14.0.0, Node 22.19+ | `@size-limit/file` plugin needs no bundler. Use with Angular output is untested |
| stats file diff script | Per-chunk bytes between two builds | none needed | Own script over the esbuild metafile, see below |
| RelativeCI | Managed bundle history | `@relative-ci/cli` 5.4.0 | Docs list webpack, Vite, Rollup and others, not esbuild or Angular. Verify support first |
| `@playwright/mcp` | Browser control | 0.0.82, pre-1.0 | For login and route walking, not numbers |

Do not propose: `source-map-explorer` (unmaintained since 2022), webpack-era analyzers for the esbuild builder, `bundlewatch` (low activity), the `webpagetest` npm wrapper (last published 2024-12).

Node engines differ per tool. Node 22.19 or newer satisfied every one checked, so pin it in a mixed CI job.

## Decision guide

| Situation | Propose |
|---|---|
| No CI, first look | Chrome DevTools MCP audit of a production build or deployed URL, notes to a log, state that numbers are single-run |
| Open source on GitHub with preview URLs | Own stats diff or `size-limit` on PRs, Lighthouse 5 runs with median in Actions, committed baseline |
| Private on GitHub Actions with staging | Same, self-managed. Add an LHCI server only if a history UI is wanted |
| Login-walled app | Playwright login then Lighthouse (`puppeteerScript` in lhci, or Unlighthouse cookies and headers), or sitespeed.io scripting. PSI and CrUX cannot see these routes |
| High-traffic public pages | Add sampled `web-vitals` beacons or a periodic CrUX pull. Lab gates, field decides |
| Low traffic | Lab only |
| Many pages, unknown worst routes | Unlighthouse sweep, then pin 3 to 10 routes |
| Dashboards without a vendor | sitespeed.io with Graphite and Grafana, needs a Docker host |
| No CI or noisy CI | Local or scheduled triage, mark verdicts low confidence |

## Noise rules

- Run at least 5 per URL and profile. Lighthouse's variance doc states the median of 5 runs is twice as stable as 1 run. LHCI defaults to 3.
- Report median plus spread (min and max).
- Same runner class, same Node, Chrome and Lighthouse versions, no concurrent Lighthouse runs on one machine, no burstable or function-as-a-service instances.
- Test the production build served statically, never `ng serve`.
- Lighthouse mobile default is 150 ms RTT, 1.6 Mbps down, 4x CPU slowdown with simulated throttling. Record the profile.
- Record the Lighthouse BenchmarkIndex per run so a slow runner is visible.
- Compare raw metrics (LCP, TBT, CLS, transfer bytes), not the 0 to 100 score.
- Lighthouse navigation mode cannot analyze SPA route transitions. Treat each route as a cold deep-link load and say so.

## Baseline file

Commit small aggregated numbers only. Keep raw Lighthouse JSON in CI artifacts, which expire. Suggested layout:

- `perf/baseline.json` current accepted numbers
- `perf/routes.json` explicit route list
- `perf/log.md` or `perf/results.jsonl` one dated entry per comparison (date, base SHA, head SHA, verdict, deltas)
- a pointer from `_architecture/` per the repo's paper-trail convention

Minimal `perf/baseline.json` (proposal, untested):

```json
{
  "schema": 1,
  "recordedAt": "2026-09-21T12:00:00Z",
  "commit": "<sha>",
  "angular": "22.1.8",
  "builder": "@angular/build:application",
  "env": { "where": "ci", "runner": "ubuntu-24.04", "node": "22.19.0", "chrome": "<ver>", "lighthouse": "13.5.0", "benchmarkIndex": 1400 },
  "profile": { "formFactor": "mobile", "throttling": "simulated-default", "cpuSlowdown": 4, "auth": false, "cache": "cold", "runs": 5 },
  "target": "https://staging.example.com",
  "routes": {
    "/": {
      "lcp": { "median": 2100, "min": 1950, "max": 2300 },
      "tbt": { "median": 180, "min": 140, "max": 260 },
      "cls": { "median": 0.01 },
      "transferKb": 640
    }
  },
  "bundle": { "initialBrotliKb": 118, "chunks": { "main": 92, "polyfills": 12 } },
  "field": { "source": "crux", "p75": { "lcp": 2400, "inp": 180, "cls": 0.05 }, "window": "28d" },
  "tolerance": { "lcpPct": 10, "tbtPct": 20, "clsAbs": 0.02, "bundleKb": 5 }
}
```

Other places to store results: LHCI server (history UI, needs hosting), `temporary-public-storage` (no history, no diff, public), Grafana via sitespeed.io (ops cost).

## Comparing old and new

1. Confirm the profile, environment and tool versions match the baseline. If Lighthouse, Chrome, Node or runner type changed, re-baseline in a separate commit with the reason.
2. Compare per-route medians. Flag a change only if the delta exceeds the tolerance and the head median falls outside the baseline min to max range.
3. For PRs, prefer a paired run in one job: build base and head, alternate runs. This removes runner-to-runner drift.
4. Deterministic metrics (bytes, request count, chunk sizes) get tight tolerances. Timing metrics (LCP, TBT) get wide ones.
5. Verdict words: improved, neutral, regressed, inconclusive. One run or mismatched environments is inconclusive.
6. Absolute thresholds (lhci assertions, budgets) answer "is it under the limit", not "did it get worse".

## Recipes (all untested unless noted)

Chrome DevTools MCP one-off audit: `navigate`, `emulate` (CPU throttling 4x, Slow 4G), `performance_start_trace` with `reload`, `performance_analyze_insight` (for example `LCPBreakdown`), then `list_network_requests` for large or uncached assets. A trace is one sample, repeat and take the median yourself.

Bundle diff over the stats file (option `statsJson`, file `stats.json` on 22.1.6, see `build-and-deploy.md`): build base and head, then compare `outputs[*].bytes` per chunk. Map chunks by entry or name because hashed filenames change. The metafile shape (`inputs`, `outputs` with byte sizes) is esbuild's.

Lighthouse median in CI: `npm ci`, `ng build`, serve `dist/<project>/browser`, run `npx lighthouse <url> --output=json --output-path=run-N.json` five times, take medians with a small script, write the summary to `perf/`.

lhci: `lighthouserc.json` with `collect.numberOfRuns` 5, `aggregationMethod` `median`, `assertMatrix` for per-URL assertions, upload target `filesystem` or `temporary-public-storage`. Auth uses `puppeteerScript` (puppeteer installed separately). `budgetsFile` cannot combine with other assert options. GitHub status checks need `LHCI_GITHUB_APP_TOKEN` or `LHCI_GITHUB_TOKEN`.

`size-limit`: `@size-limit/file` plugin over `dist/**/*.js` with brotli. Fit with the Angular esbuild output is an inference.

RUM: `web-vitals/attribution` beacon with sampling. Per beacon record metric name, value, rating, navigation type, route template (not the raw URL), attribution target, release id (git SHA), device class. Check the v6 README before writing snippets, since the README fetched said v5 is current while npm shows 6.2.2.

CrUX pull: `POST https://chromeuxreport.googleapis.com/v1/records:queryRecord` with a key, form factor and origin or URL. Weekly is enough given the 28-day window.

## Scheduling

| Option | Runs where | Limits |
|---|---|---|
| GitHub Actions `schedule` | GitHub runner | Minimum 5 minutes, delays under load, default branch only, public repos auto-disabled after 60 days without activity |
| Other CI cron | CI runner | Not researched |
| Claude Code Routines (`/schedule`) | Anthropic cloud, fresh clone | Minimum 1 hour, daily run caps by plan, research preview. Default network is an allowlist so deployed-site audits need it changed. Chrome availability in the sandbox not verified |
| Desktop scheduled tasks | The user's machine | Minimum 1 minute, machine must be on, numbers depend on that machine |
| `/loop` | Open session | Minimum 1 minute, 7-day expiry, not for perf history |

For history use CI cron. Use Routines or `/loop` for triage on top of CI output (read the latest artifact, open an issue), not for taking measurements. Alerts: CI failure notification, a workflow step that opens an issue on regression, or a Slack webhook. Costs: CI minutes (routes times profiles times 5 runs adds up), hosting for LHCI or Grafana, RUM storage, Routine usage.

## What an agent can and cannot conclude

Can: run and parse lab tools, read traces, name causes (LCP breakdown, long tasks, large chunks), write config and workflow files for the user to review, update the baseline and log, compare JSON files.
Cannot: get stable numbers from one run, judge significance without repeats, produce field data, audit auth-walled or private deployments from a cloud sandbox or vendor APIs, compare across machines or tool versions.

## Unverified, check before relying

- `--stats-json` documentation on angular.dev, and the stats file name before `main`.
- WebPageTest hosted status and pricing, PSI quotas and parameters, CrUX history API, BigQuery and Search Console details.
- How lhci picks a base build for diffs, and `temporary-public-storage` retention.
- sitespeed.io budget and compare flags.
- Handing a Playwright browser to Lighthouse, and web-vitals soft-navigation reporting.
- `size-limit`, `compressed-size-action` and RelativeCI with Angular esbuild output.
- Routine daily caps and Chrome in the Routine sandbox.
- Statistical thresholds (Mann-Whitney, sessions needed per RUM bucket).
- Whether field data is the only INP source. Lab has TBT as a proxy only.
