# Measuring and automating

Measure the same route with the same tool before and after every change. Without a baseline number, a fix is a guess.

## Tools

- **Angular DevTools** (browser extension): the profiler shows each change-detection cycle, what triggered it, and time per component. A stream of cycles with no user input means zone pollution or a timer.
- **Chrome performance panel**: Angular adds its own track (v20+). Record an interaction to debug INP: find the long task after the input event.
- **Lighthouse**: lab LCP, TBT (INP proxy), CLS, and specific opportunities. Mobile preset, 3+ runs, compare medians.
- **Memory**: Chrome Memory panel heap snapshots before and after navigating away and back. Detached DOM or component instances that grow each round mean a missing teardown.
- **Field data**: `web-vitals` (`onLCP`, `onINP`, `onCLS`, attribution build) sent to analytics. The only source that reflects real users.

## Bundle analysis

- `ng build --configuration production` prints initial and lazy chunk sizes, and warns or fails on budgets.
- `ng build --configuration production --stats-json` writes an **esbuild metafile** under `dist/<project>/` (`stats.json` on 22.1.6, `browser-stats.json` in `main` source. See `build-and-deploy.md`) since the v17 application builder. Load it at esbuild.github.io/analyze. `webpack-bundle-analyzer` does not read it.
- Alternative: `source-map-explorer` over the built JS, with `sourceMap: true` and `namedChunks: true` temporarily enabled.

## Budgets (`angular.json`)

```json
"budgets": [
  { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
  { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
]
```

Set `maximumError` just above the current size, not at a number that never fires. Other types: `bundle` (with `name`), `anyScript`, `any`, `all`. A `baseline` plus percentage thresholds also works.

## CI gates

- **Build**: `ng build --configuration production` fails on `maximumError`.
- **Lint**: `angular-eslint` rules `@angular-eslint/template/no-call-expression` (tune `allowList`/`allowPrefix` if it flags signal reads in your version) and `@angular-eslint/prefer-signals`. Run `ng lint`.
- **Lighthouse CI**: `npx @lhci/cli autorun` with a `lighthouserc.json`. The package's last release was 2025-06 and it bundles an older Lighthouse than the current one, so check it before adopting. Diffing against a base branch needs an LHCI server. See `measurement-automation.md`:
  ```json
  {
    "ci": {
      "collect": { "numberOfRuns": 3, "url": ["http://localhost:4200/"] },
      "assert": {
        "assertions": {
          "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
          "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
          "categories:performance": ["warn", { "minScore": 0.9 }]
        }
      }
    }
  }
  ```
  Set thresholds a little above current results to catch regressions without failing every build. Lighthouse and LHCI versions move fast, check current docs for the config shape.
- **User journeys**: Playwright traces (`page.tracing` or CDP) for multi-step flows and INP under scripted interaction.

A green LHCI run is necessary, not sufficient. Confirm with field data where it exists.
