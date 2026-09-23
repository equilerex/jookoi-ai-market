 # ARCHITECTURE
<!-- Why the repo is shaped this way. Changed only when structure or key decisions change. See AGENTS.md. -->

## What this repo is

Personal Claude Code plugin marketplace. Optional, richer extension layer on top of `JooKoi-developer-stack` — that repo stays the portable, harness-agnostic baseline; this repo holds domain-specific and heavier tooling that needs actual plugin machinery (manifests, shared assets, eventually hooks/MCP). See baseline's `_architecture/plans/decisions/014-personal-plugin-marketplace-as-optional-extension-layer.md`.

## Layout

- `.claude-plugin/marketplace.json` — catalog listing the plugins below.
- `plugins/jookoi-dev/` — one broad plugin, not fragmented per-topic. Split a capability into its own plugin only when it needs independent distribution, versioning, or audience.
- `plugins/jookoi-dev/skills/`: `jookoi-paper-trail`, `jookoi-create-skill`, `jookoi-write-like-a-person`, and `jookoi-write-casual-technical` are copies of baseline-universal skills. `jookoi-vue3-vibe-code`, `jookoi-fastled`, and `jookoi-angular-performance` are domain-specific and live here natively. Domain skills that pin a framework version carry a sibling `README.md` with provenance (verified baseline, date, refresh checklist).

## Baseline relationship

`JooKoi-developer-stack` works standalone with no knowledge this repo exists. Copied skills' source of truth is the baseline repo — updates there don't auto-propagate here; re-copy by hand when a baseline skill changes and this plugin should pick it up.
