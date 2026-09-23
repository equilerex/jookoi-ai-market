# Angular perf measurement, baselines, comparison: research

Date: 2026-09-21. Scope: measurement tooling, baselines, comparison, scheduling. Builder options, budgets and generic CI gates live in `angular-docs-deploy-research.md` (not repeated).

Verification key: **[V]** fetched from the cited page or npm/GitHub API today. **[U]** unverified (from search snippets, secondary sources, or not fetched). Versions and dates come from `npm view` and `api.github.com` on 2026-09-21.

## 0. Maintenance snapshot

| Tool | Latest (npm) | Last npm publish | Repo last push | Status |
|---|---|---|---|---|
| lighthouse | 13.5.0 | 2026-09-19 | 2026-09-20 | active [V] |
| @lhci/cli | 0.15.1 | 2025-06-25 | 2026-03-27 | slow; last release 15 months ago; bundles lighthouse 12.6.1 while current is 13.5.0 [V] |
| unlighthouse | 0.18.0 | 2026-06-29 | not fetched (repo moved to harlan-zw/unlighthouse per npm) | active-ish; needs Node >= 22.18 [V] |
| sitespeed.io | 42.7.0 | 2026-09-11 | 2026-09-16 | active; Node >= 22 [V] |
| webpagetest (npm wrapper) | 0.7.6 | 2024-12-03 | n/a | stale wrapper; WPT is now Catchpoint-owned, hosted plan/API terms unverified [U] |
| web-vitals | 6.2.2 | 2026-09-14 | 2026-09-14 | active [V] |
| chrome-devtools-mcp | 1.9.0 | 2026-09-08 | 2026-09-21 | very active, 52k stars; Node ^20.19 or ^22.12 or >=23 [V] |
| @playwright/mcp | 0.0.82 | 2026-09-18 | 2026-09-18 | active, pre-1.0 [V] |
| @danielsogl/lighthouse-mcp | 2.0.1 | 2026-08-15 | 2026-09-21 | active, community, Node >= 22 [V] |
| lighthouse-mcp (unscoped) | 0.1.17 | 2026-09-13 | not checked | unknown author, 0.x [U] |
| size-limit | 14.0.0 | 2026-09-15 | 2026-09-15 | active; Node ^22.19 or ^24.5 or >=26 [V] |
| bundlewatch | 0.4.2 | 2026-04-21 | 2026-04-21 | low activity, webpack-era, 444 stars [V] |
| @relative-ci/cli | 5.4.0 | 2026-08-22 | agent repo pushed 2026-09-21 | active vendor [V] |
| esbuild-visualizer | 0.7.0 | 2024-12-27 | n/a | stale but stable [V] |
| source-map-explorer | 2.5.3 | 2022-09-26 | n/a | unmaintained [V] |
| treosh/lighthouse-ci-action | n/a | n/a | 2026-03-12 | quiet [V] |
| preactjs/compressed-size-action | n/a | n/a | 2026-06-19 | webpack/`build-script`-based [V] |
| @angular/cli | 22.1.8 | 2026-09-16 | n/a | reference version [V] |

Node engine requirements differ per tool, so a CI job mixing lighthouse, lhci and size-limit must pin a Node version that satisfies all (Node 22.19+ satisfies the ones checked).

## 1. Lab tools

### Lighthouse CLI
- `npx lighthouse <url> --output=json --output-path=...`, node API, and user flows. 13.5.0 [V].
- Variance doc (https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md) [V]: seven variance sources (page nondeterminism, local network, tier-1 network, web server, client hardware, resource contention, browser nondeterminism). Advice: run multiple and aggregate; quote: "The median Lighthouse score of 5 runs is twice as stable as 1 run". Avoid FaaS and burstable instance types; suggests m5.large / n2-standard-2 / Azure D2 class; never run concurrent Lighthouse instances on one machine. Simulated throttling (default) mitigates most network/hardware variance better than DevTools throttling.
- Throttling (https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md) [V]: mobile default 150 ms RTT, 1.6 Mbps down, 750 Kbps up, 4x CPU slowdown. Simulated throttling is default and deterministic; DevTools (request-level) and packet-level (WebPageTest style) exist. Benchmark index ranges quoted (desktop 1500-2000, mid mobile 125-800) mean a CI runner's BenchmarkIndex should be recorded with the result.
- User flows (https://github.com/GoogleChrome/lighthouse/blob/main/docs/user-flows.md) [V]: navigation / timespan / snapshot. Navigation cannot analyze SPA transitions; timespan gives no overall score; snapshot gives no perf metrics. Docs show Puppeteer only, no Playwright mention. So SPA soft-navigation performance is weak in Lighthouse; treat each route as a fresh navigation (deep-link cold load) and say so.
- Lighthouse scoring is derived; for regression compare raw metrics (LCP, TBT, CLS, transfer bytes), not the 0-100 score.

### Lighthouse CI (lhci)
- Docs: https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md and getting-started.md [V].
- `lhci autorun` infers defaults; config `lighthouserc.js`. `collect.numberOfRuns` default 3. Presets: `lighthouse:all`, `lighthouse:recommended`, `lighthouse:no-pwa`. `aggregationMethod`: `median`, `optimistic`, `pessimistic`, `median-run`. `assertMatrix` for per-URL-pattern assertions. `budgetsFile` accepts `budget.json` but cannot be combined with other assert options. `puppeteerScript` for auth/cache setup (puppeteer installed separately).
- Upload targets: `temporary-public-storage` (public URL, no history, no diffing, no build failures; retention not stated in fetched docs, unverified), `lhci` (own server), `filesystem`.
- Base-branch comparison and diff UI need the LHCI server (SQLite/MySQL/Postgres; Docker image `patrickhulce/lhci-server`; build token for upload, admin token for edits, optional basic auth) [V]. The docs fetched do not state the mechanism for choosing the base build (ancestor hash etc.) [U].
- GitHub status checks: `LHCI_GITHUB_APP_TOKEN` (GitHub App) or `LHCI_GITHUB_TOKEN` (PAT, `repo:status`) [V].
- Caveat: last release June 2025, bundles Lighthouse 12.6.1 vs 13.5.0 current. Scores from lhci and a current `lighthouse` CLI are not directly comparable across that gap. Pin one and record it.
- Assertions here are absolute thresholds per run, not "worse than base by X%". Relative comparison needs the server or your own script over `filesystem` output.

### Unlighthouse
- Site-wide crawl with sampling, SPA/sitemap route discovery, `unlighthouse-ci` mode with budgets, cookies/extraHttpHeaders for auth (details not shown) [V]. `npx unlighthouse --site <url>`; Node >= 22.18. Good for "which routes are worst" triage, weaker as a strict regression gate (sampling means route set may vary; pin routes explicitly for baselines) [U on exact CI flags].

### sitespeed.io
- 42.7.0 [V]. Browsertime-based, Docker image, Graphite/Grafana dashboard with user-journey dashboards, CrUX panels, S3/GCS storage (https://www.sitespeed.io/documentation/sitespeed.io/performance-dashboard/) [V]. Budget and compare plugin flags (`--budget.configPath`, iterations, connectivity) were not on the fetched page [U]; check docs when writing recipes. Best fit for a self-hosted, long-running time series with real-browser scripting (login flows). Heavier to operate than lhci.

### WebPageTest
- npm wrapper `webpagetest` 0.7.6, last published Dec 2024 [V]. Hosted service and API terms (free tier, pricing, Catchpoint ownership) could not be fetched [U]. Offers packet-level throttling and multi-location. Treat as optional paid/third-party, ask before proposing.

### PageSpeed Insights API
- Endpoint `https://www.googleapis.com/pagespeedonline/v5/runPagespeed`, `key` recommended for automated use, returns Lighthouse lab result plus `loadingExperience` (URL-level CrUX) and `originLoadingExperience` (origin-level) [V] (https://developers.google.com/speed/docs/insights/v5/get-started). Quota numbers and `strategy`/`category` params not on the fetched page [U].
- Only works for publicly reachable URLs (no localhost, no auth-walled pages) [U, follows from being a remote service]. Lab run happens on Google's infrastructure, so it also varies run to run. Useful for "deployed site, lab + field in one call".

### Playwright / Puppeteer
- Playwright 1.63.0 [V]. Use for scripted login and route walking, then either hand the browser to Lighthouse via remote debugging port (Lighthouse node API takes a port/page; recipe untested [U]) or collect `PerformanceObserver`/Navigation Timing/Long Animation Frame yourself. Playwright traces (`context.tracing`) are for debugging, not for stable perf numbers [U]. Chromium tracing via CDP (`browser.startTracing`) exists in Playwright [U, not fetched].
- Custom in-browser metrics via `web-vitals` inside Playwright give LCP/CLS/INP for scripted flows, including SPA route changes (web-vitals reports soft navigations only if the option/experiment is enabled [U]).

### Noise handling (synthesis of the above)
- Run n >= 5 per URL and profile; report median and spread (min/max or MAD). LHCI default is 3, Lighthouse docs cite 5 [V].
- Same runner class, same Node/Chrome/Lighthouse versions, no concurrent jobs, no burstable instances [V].
- Compare A and B in the same job, alternating runs, when judging a PR (removes runner-to-runner drift) [U, standard practice, not a cited claim].
- Record the Lighthouse BenchmarkIndex per run and discard/flag runs whose index deviates [U, inferred from throttling doc].
- Serve production build (`ng build` then a static server), never `ng serve`.

### Authenticated routes
- lhci: `puppeteerScript` [V]. Unlighthouse: cookies/extraHttpHeaders [V, details unfetched]. Lighthouse CLI: `--extra-headers`, cookies via flow [U]. Chrome DevTools MCP: `emulate` can set `extraHttpHeaders`, and the agent can log in with `fill`/`click` in a real session [V for emulate]. PSI and CrUX cannot see auth-walled pages.

## 2. Field / RUM

- **web-vitals** npm 6.2.2 [V]. README fetched via raw GitHub says "v5 is current major" and FID deprecated: **source disagreement** with npm 6.2.2 (README text may be stale or the fetch summary wrong). Verify the v6 changelog before writing snippets. API: `onLCP/onINP/onCLS/onFCP/onTTFB`, `import ... from 'web-vitals/attribution'` (+~1.5 KB brotli), `reportAllChanges`, beacon via `navigator.sendBeacon`. Attribution: LCP (`target`, `url`, `timeToFirstByte`, `resourceLoadDelay`, `resourceLoadDuration`, `elementRenderDelay`), INP (`interactionTarget`, `interactionType`, `inputDelay`, `processingDuration`, `presentationDelay`, `longAnimationFrameEntries`, `longestScript`) [V] (https://github.com/GoogleChrome/web-vitals).
- **CrUX API**: `POST https://chromeuxreport.googleapis.com/v1/records:queryRecord`, key required, 150 queries/min/project free, no quota raise, ~2 days behind, 28-day rolling window, form factors PHONE/TABLET/DESKTOP, origin or URL, metrics CLS, FCP, INP, LCP, TTFB [V] (https://developer.chrome.com/docs/crux/api). `queryHistoryRecord` exists; its details were not on the fetched page [U]. Low-traffic URLs have no data (threshold not stated in fetched page [U]).
- **CrUX Dashboard / BigQuery / Search Console CWV report**: not fetched. Known to exist; details, dataset names and update cadence are [U]. Search Console groups URLs by template and needs site ownership; PSI/CrUX API do not [U].
- **Self-hosted vs vendor RUM**: no vendor docs fetched, so no vendor claims here [U]. Tradeoff logic: self-hosted = beacon endpoint plus a table (cheap, needs storage, dashboards and privacy handling); vendor = less work, cost scales with pageviews, data leaves your domain. Sampling: record every metric event from a fixed percentage of sessions (e.g. 10%, decided by traffic), keep the sampling rate in the payload.
- What to record per beacon: metric name, value, rating, id, navigationType, page route template (not raw URL with ids), attribution target/breakdown, deployment version (git SHA or Angular build id), device class, connection effectiveType if available. Compare p75 per route per release, needs enough sessions per bucket (rule of thumb: hundreds; unverified).
- Field data is the only source of truth for INP; lab has no equivalent (TBT is a proxy) [V in Lighthouse metric docs is not fetched; treat as [U]].

## 3. AI / MCP options

### Chrome DevTools MCP (`chrome-devtools-mcp` 1.9.0) [V]
Tool reference: https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md
- `performance_start_trace` (`reload`, `autoStop`, `filePath`), `performance_stop_trace`, `performance_analyze_insight` (`insightName` e.g. `LCPBreakdown`, `DocumentLatency`; `insightSetId`).
- `lighthouse_audit` (`mode`: navigation|snapshot, `device`: desktop|mobile) covers accessibility, SEO, best practices, agentic browsing and **excludes performance**; use the trace tools for performance. This is a change from what older blog posts describe (search snippets say the same) [V].
- `emulate` (cpuThrottlingRate, networkConditions Slow 3G..Fast 4G, viewport, userAgent, extraHttpHeaders), network tools (`list_network_requests`, `get_network_request`), console tools, `take_heapsnapshot`.
- Search snippet says traces surface CrUX context when eligible field data exists [U].
- One-off audit flow: navigate, `emulate` (CPU 4x, Slow 4G), `performance_start_trace` with reload, `performance_analyze_insight` on LCPBreakdown/INP-related insights, read network list for large/uncached assets. Before/after: save both traces with `filePath` and compare the numbers by hand; there is no built-in diff tool [inferred from tool list].
- Limits: a single trace is one noisy sample; the agent must repeat and take medians itself (costly in tokens); local dev server numbers are not deployed numbers (no CDN, compression, HTTP/2, real TLS); local machine CPU differs from CI so absolute values are not comparable across machines.

### Playwright MCP (`@playwright/mcp` 0.0.82) [V version only]
Accessibility-snapshot driven browser control. Good for scripted login and route walking; perf tooling not verified [U]. Pair with a lab tool rather than using it for numbers.

### Lighthouse / PSI MCP servers
- `@danielsogl/lighthouse-mcp` 2.0.1, MIT, runs local Chrome via Lighthouse, tools include `run_audit`, `get_performance_score`, `get_core_web_vitals`, `check_performance_budget`, `compare_mobile_desktop`, `find_unused_javascript`, supports attaching to an existing Chrome and persistent profiles for logins [V] (https://github.com/danielsogl/lighthouse-mcp-server). No base-vs-head compare (only mobile vs desktop).
- Unscoped `lighthouse-mcp` 0.1.17 [V exists, provenance U]. A PSI-specific MCP was not found by name on npm (`psi-mcp-server` 404) [V]; others may exist [U].

### Existing agent skills
- `addyosmani/web-quality-skills`: six stack-agnostic skills (audit, performance, core-web-vitals, a11y, seo, best-practices), MIT, 2.8k stars, last push 2026-08-24; example thresholds only, no baseline/compare tooling, Angular not mentioned [V] (https://github.com/addyosmani/web-quality-skills).
- `addyosmani/agent-skills` has an `agents/web-performance-auditor.md` (98k stars, pushed 2026-09-20) [V exists; contents not read].
- `cloudflare/skills` has a `web-perf` skill (pushed 2026-09-08) [V exists via search + repo API; contents not read]. `langgenius/mosoo-skills` web-perf: 2 stars, ignore. `warpdotdev/oz-skills` web-performance-audit listed by a search index [U].
- Gap this skill can fill: baseline file, comparison method, Angular specifics, collaborative setup.

### What an agent can and cannot do reliably
- Can: run and parse lab tools, read traces, name causes (LCP breakdown, long tasks, large chunks), write config and workflow files, write and update the in-repo baseline and results log, compare JSON files.
- Cannot: get stable numbers from one run; judge significance without repeats; produce field data; audit auth-walled or private deployments from a cloud sandbox (Routines default network is an allowlist, see section 6) or from the vendor APIs; compare across different machines/tool versions.
- Default rule for the skill: agent-run audits are diagnostic. Regression verdicts come from repeated runs in the same environment, ideally CI.

## 4. Bundle regression tracking (esbuild application builder)

- Angular esbuild builder can emit an esbuild metafile as `stats.json` with `ng build --stats-json` (source: search results citing angular-cli commit 839d0cb and blog posts; not confirmed on angular.dev, the build docs page I fetched did not mention it) [U]. Metafile has `inputs`/`outputs` with byte sizes, so it can be diffed with a 20-line script, or opened in https://esbuild.github.io/analyze [U].
- Own-script diff: build both refs, compare `outputs[*].bytes` per chunk (map chunks by entry/name, since hashed filenames change). Cheap, no dependency, works for any CI. Recommended default.
- **size-limit** 14.0.0 [V]: plugins `@size-limit/file` (brotli/gzip/none on built files; the natural fit for esbuild builder output since it needs no bundler), `@size-limit/esbuild`, `webpack`, `rolldown`, `time` (headless Chrome). Config in `package.json`, `.size-limit.json|js|ts`. Official GitHub Action comments size changes on PRs. `compareWith` (stats.json path) exists in config [V from README]. Angular use with `file` plugin against `dist/**/*.js` is my inference [U, untested]. Needs Node ^22.19.
- **bundlewatch** 0.4.2, last push April 2026, webpack-era, compares file sizes against base branch via its service [U on service still running]. Low priority.
- **RelativeCI**: vendor service, `@relative-ci/cli` 5.4.0 active. Fetched docs list webpack, rspack, Vite, Rollup, Next.js and others but do not mention esbuild or Angular [V for the gap]. Angular via esbuild `stats.json` is [U]; ask vendor docs before proposing. Free/OSS terms [U].
- **compressed-size-action** (preactjs): builds base and PR and diffs, driven by a build script [V exists]; works on any output folder in principle, Angular fit untested [U].
- **Angular budgets** (`angular.json` `budgets`) are the in-build gate; detailed in the other research file. They only give a pass/fail against fixed numbers, no history.
- Older tools that assume webpack stats (webpack-bundle-analyzer, source-map-explorer 2.5.3 unmaintained since 2022) should not be proposed for the esbuild builder [V for maintenance].

## 5. Baselines and comparison

### What to record
- Metric set: lab LCP, FCP, TBT, CLS, Speed Index, TTFB (median and spread), total transfer bytes, JS bytes, request count; bundle: initial total and per-chunk bytes (brotli and raw); optional field p75 LCP/INP/CLS from CrUX API.
- Route list (explicit URLs, template vs concrete), auth state, cold vs warm cache, device (mobile/desktop), throttling preset and CPU multiplier, Lighthouse form factor.
- Provenance: commit SHA, branch, date, Angular version, builder, Node version, Chrome version, tool versions (lighthouse, lhci), runner type, BenchmarkIndex, run count, target URL (local build vs deployed).

### Where to store
| Option | Pros | Cons |
|---|---|---|
| Committed `perf/baseline.json` + `perf/results/*.json` or one JSONL log | Future sessions and humans can read it; diffable; no infra | Repo noise; must update deliberately; runner-specific numbers |
| CI artifacts | No repo noise | Expire (retention limits, [U] exact defaults); hard for an agent to fetch later |
| LHCI server | History UI, diffs, status checks | Host and secure a server; tool release cadence slow |
| Temporary public storage | Zero setup | No history, no diff, public [V] |
| External vendor / Grafana (sitespeed) | Trends, alerting | Cost or ops |

Recommendation: committed baseline (small, reviewed) + CI artifact for raw reports. Only the aggregated numbers go in git, raw Lighthouse JSONs do not.

### Minimal `perf/baseline.json` proposal (untested, proposal only)
```json
{
  "schema": 1,
  "recordedAt": "2026-09-21T12:00:00Z",
  "commit": "a8fc05c",
  "angular": "22.1.8",
  "builder": "@angular/build:application",
  "env": { "where": "ci|local", "runner": "ubuntu-24.04", "node": "22.19.0", "chrome": "<ver>", "lighthouse": "13.5.0", "benchmarkIndex": 1400 },
  "profile": { "formFactor": "mobile", "throttling": "simulated-default", "cpuSlowdown": 4, "auth": false, "cache": "cold", "runs": 5 },
  "target": "https://staging.example.com",
  "routes": {
    "/": { "lcp": {"median": 2100, "min": 1950, "max": 2300}, "tbt": {"median": 180, "min": 140, "max": 260}, "cls": {"median": 0.01}, "transferKb": 640 },
    "/dashboard": { "...": "..." }
  },
  "bundle": { "initialBrotliKb": 118, "chunks": { "main": 92, "polyfills": 12 } },
  "field": { "source": "crux", "p75": { "lcp": 2400, "inp": 180, "cls": 0.05 }, "window": "28d" },
  "tolerance": { "lcpPct": 10, "tbtPct": 20, "clsAbs": 0.02, "bundleKb": 5 }
}
```
Plus `perf/log.md` or `perf/results.jsonl`: one dated entry per comparison (date, base SHA, head SHA, verdict, deltas, link to CI artifact), and an `_architecture` pointer per the repo's paper-trail convention.

### Comparing old vs new and judging significance
- Compare medians per route within the same profile and environment; flag only if delta exceeds both (a) tolerance and (b) observed spread of the baseline runs (e.g. head median outside baseline min..max). Simple and explainable; a Mann-Whitney U test on run values is stronger but needs n >= 5 per side, better ~10 [U, statistics practice, no source fetched].
- Prefer paired same-job A/B (build base ref and head ref, alternate runs) for PRs. Absolute-threshold assertions (lhci) answer a different question ("is it under budget") than regression ("did it get worse").
- Deterministic metrics (bytes, request count, chunk sizes) get tight tolerances; timing metrics get wide ones (TBT and LCP on shared runners are noisy).
- Re-baseline deliberately (new commit with reason) when Lighthouse, Chrome, runner type or Node changes, since that shifts numbers without a code change. Keep old baseline in git history.

## 6. Scheduling

| Option | Runs where | Interval | Notes |
|---|---|---|---|
| GitHub Actions `schedule` | GitHub runner | min 5 min; delays at high load; default branch only; public repos auto-disabled after 60 days of no activity [V] | Free minutes on public repos, plan minutes on private [U]; same runner class each run helps variance |
| Other CI cron (GitLab, Azure, etc.) | CI runner | provider-specific | Not researched [U] |
| Claude Code Routines (`/schedule`) | Anthropic cloud, fresh clone | min 1 hour; daily run caps by plan (search snippet: ~5 Pro, 15 Max, 25 Team/Enterprise, unverified; official page says cap exists without numbers); research preview [V] | Default environment network is an allowlist, so deployed-site audits need network access changed; requires claude.ai login; runs use subscription usage; can trigger via API or GitHub PR events; Chrome availability in the sandbox not verified [U]; noisy shared environment |
| Desktop scheduled tasks | your machine | min 1 min [V] | Local files, machine must be on; numbers depend on your machine |
| `/loop` | open session | min 1 min, 7-day expiry, session must be open [V] | Polling/babysitting only, not for perf history |

Guidance: for perf history use CI cron (deterministic environment, artifacts, alerts). Use Routines/`/loop` for triage on top of CI output (read latest artifact, open issue) rather than for taking measurements. Alerting: CI job failure notification, a GitHub issue opened by a workflow step on regression, or Slack webhook; sitespeed.io/Grafana has its own alerting (not verified) [U]. Cost: CI minutes (Lighthouse runs of 5 x routes x profiles add up; the variance doc estimates ~$0.0008 per report on recommended cloud instances [V]), LHCI/Grafana hosting, RUM storage, Routine usage.

## 7. Decision guide

Questions to ask first (short, decision-bearing):
1. Is the code public or private, and which CI provider (GitHub Actions, GitLab, Azure, none)?
2. Where is it deployed (preview URLs per PR, staging only, prod only, none), and is it reachable from CI?
3. Are the important routes behind login? Can we get a test account or a token?
4. What traffic level (RUM/CrUX viable above roughly a few thousand page views per month per route [U])?
5. Goal: one-off audit, PR regression gate, or long-term trend?
6. Is a hosted service or server allowed (data leaving, budget, ops capacity)?
7. Which routes matter (3-10), and which device/network target?
8. May results and baseline be committed to the repo?

| Project traits | Propose |
|---|---|
| Any, first look, no CI | Chrome DevTools MCP one-off audit (trace + insights) against deployed or local prod build, results written to `perf/log.md`; state numbers are single-run |
| Open source, GitHub, public preview URLs | Own script or size-limit for bundles in PR; Lighthouse (5 runs, median) via `lighthouse` CLI or lhci `filesystem` in Actions; committed baseline; optional lhci temporary public storage for shareable reports |
| Private, GitHub Actions, staging URL | Same as above, self-managed; consider LHCI server only if history UI is wanted; nightly `schedule` run appended to results log |
| Auth-walled app | Playwright login then Lighthouse via `puppeteerScript` (lhci) or unlighthouse cookies/headers, or sitespeed.io scripting; PSI/CrUX unusable for those routes; test account in CI secrets |
| High traffic, public pages | Add RUM via `web-vitals` attribution beacon (sampled) and/or CrUX API weekly p75 pull; lab for gating, field for truth |
| Low traffic | Lab only; CrUX likely has no URL-level data (origin maybe) |
| Many pages, unknown worst routes | Unlighthouse sweep for triage, then pin 3-10 routes for the baseline |
| Wants dashboards/trends without vendor | sitespeed.io + Graphite/Grafana (needs Docker host) |
| Wants managed bundle history | RelativeCI (verify Angular/esbuild support first) |
| No CI provider or CI too noisy | Scheduled Routine or local run for triage only, mark verdicts low-confidence |

## Proposed skill content: `references/measurement-automation.md`

Outline:

1. **When to load this** (user asks to set up perf measurement, record baseline, compare versions, schedule runs). Rule: agent single runs are diagnostic; verdicts need repeated runs in one environment.
2. **Ask first** (8 questions from section 7, ask only unresolved ones, offer concrete options).
3. **Options table** (tool, measures, needs deployed URL, auth support, history, maintenance status with date, Node requirement, verdict). Rows: Lighthouse CLI, lhci (note stale release + bundled Lighthouse 12.6.1), Unlighthouse, sitespeed.io, PSI API, Playwright + Lighthouse/web-vitals, WebPageTest (verify), Chrome DevTools MCP, Playwright MCP, `@danielsogl/lighthouse-mcp`, web-vitals RUM, CrUX API, size-limit, esbuild `stats.json` diff script, RelativeCI (verify), Angular budgets (link to other file). Include "do not propose" list: source-map-explorer, webpack-only tools, bundlewatch (low activity).
4. **Noise rules**: n>=5, median+spread, same runner/profile/versions, no concurrency, prod build, alternate A/B in same job, record BenchmarkIndex, re-baseline on tool/runner change.
5. **Baseline format** (the JSON above) and file layout: `perf/baseline.json`, `perf/results.jsonl` or `perf/log.md`, `perf/routes.json`, `perf/README` pointing to `_architecture/`. Raw reports stay in CI artifacts.
6. **Comparison procedure** (same profile check, per-route median delta vs tolerance and baseline spread, deterministic vs timing metrics, verdict wording: improved/neutral/regressed/inconclusive, when to re-baseline).
7. **Setup recipes** (each marked untested until run):
   - One-off audit with Chrome DevTools MCP (tool sequence in section 3).
   - Lighthouse 5 runs + median script in a GitHub Actions job (`npm ci`, `ng build`, static server, `npx lighthouse ... x5`, jq median, write JSON).
   - lhci `filesystem` or `temporary-public-storage` with `lighthouserc.js` (`numberOfRuns: 5`, `aggregationMethod: 'median'`, `assertMatrix`).
   - Auth: `puppeteerScript` outline.
   - `ng build --stats-json` + `node scripts/bundle-diff.mjs base head` (metafile `outputs[*].bytes`).
   - size-limit `file` plugin config over `dist/**/*.js` with brotli.
   - `web-vitals/attribution` beacon snippet with sampling and release id (verify v6 API first).
   - CrUX API weekly pull (`records:queryRecord`, key required, 150 qpm).
   - Schedule: Actions `schedule` cron stanza; `/schedule` routine prompt "run perf workflow artifacts triage" with caveats.
8. **Scheduling and alerting comparison** (table from section 6) and cost notes.
9. **Decision table** (section 7) and "what an agent can/cannot conclude" block.
10. **Maintenance note**: re-check versions/status quarterly; list the [U] items to verify before a recipe is presented as working.

## Unverified, unmaintained, or disagreeing (summary)
- Unverified: WebPageTest current status/pricing; PSI quotas and params; CrUX history API, BigQuery, Dashboard, Search Console; RUM vendors; Angular `--stats-json` on angular.dev; size-limit and compressed-size-action with Angular output; RelativeCI esbuild/Angular support; lhci base-build selection and temp storage retention; sitespeed budget/compare flags; Playwright performance APIs; Routine daily caps (blog snippets only); Chrome in Routine sandbox; statistical thresholds (Mann-Whitney, RUM session counts).
- Stale/low maintenance: `@lhci/cli` (last release 2025-06, bundles Lighthouse 12.6.1), `webpagetest` npm wrapper (2024-12), `source-map-explorer` (2022), `esbuild-visualizer` (2024-12, stable), `bundlewatch` (low activity).
- Disagreements: web-vitals npm 6.2.2 vs README stating v5 is current; older blogs say Chrome DevTools MCP `lighthouse_audit` covers performance, tool reference says it excludes performance.
