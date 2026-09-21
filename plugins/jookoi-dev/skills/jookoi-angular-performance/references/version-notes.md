# Version notes

What changed per major that changes performance advice. Use it to avoid recommending an API the project's version doesn't have, or a name it has since renamed.

| Major | Released | Changes that matter here |
|---|---|---|
| v22 | Jun 2026 | OnPush is the default change-detection strategy. Signal Forms stable. `resource` / `httpResource` stable. First release on the 12-month major cadence. |
| v21 | Nov 2025 | New apps zoneless by default. Signal Forms and Angular Aria experimental. Vitest default test runner. |
| v20 | May 2025 | `provideZonelessChangeDetection` (dev preview, stable in 20.2). Incremental hydration and route-level render modes stable. `provideServerRendering(withRoutes())` replaces `provideServerRouting`. Angular track in Chrome performance panel. `@angular/animations` deprecated in 20.2 in favor of `animate.enter` / `animate.leave`. |
| v19 | Nov 2024 | Standalone by default. Incremental hydration and route-level render modes in dev preview (`provideServerRouting`). `resource()` experimental. |
| v18 | May 2024 | `@defer` stable. Event replay (dev preview). Experimental zoneless (`provideExperimentalZonelessChangeDetection`). |
| v17 | Nov 2023 | Built-in control flow (`@if`, `@for`, `@switch`), `@defer` (dev preview), esbuild application builder default for new apps. |
| v16 | May 2023 | Signals (dev preview), non-destructive hydration (dev preview). |
| v15 | Nov 2022 | `NgOptimizedImage` stable, standalone APIs stable. |

## Double-check before recommending

- **Zoneless provider**: `provideExperimentalZonelessChangeDetection` (v18-v19) → `provideZonelessChangeDetection` (v20+). Default for new apps in v21+, existing apps still opt in.
- **Default change detection**: eager before v22, OnPush in v22+. The explicit opt-out strategy's name changed with the flip (`Default` before, reported as `Eager` in v22). Check the installed typings before writing it.
- **SSR route config**: `provideServerRouting` (v19) vs `provideServerRendering(withRoutes())` (v20+).
- **Incremental hydration**: needed `withIncrementalHydration()` while in preview. Current docs say it's on by default with `provideClientHydration()`.
- **`@defer` on v17**: dev preview. Hydrate triggers need v19+ and SSR.
- **Signal Forms**: experimental in v21, don't recommend for production there. Reactive Forms remain fine for large dynamic forms and third-party `ControlValueAccessor` integrations.
- **Builder**: projects created before v17 may still use the webpack `browser` builder. `ng update` offers the migration to `@angular/build:application`, which is a prerequisite for the esbuild `stats.json` workflow.
