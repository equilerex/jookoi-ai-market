# jookoi-ai-market

Personal Claude Code plugin marketplace. Optional, richer extension layer on top of [`JooKoi-developer-stack`](../JooKoi-developer-stack) — that repo stays the portable, harness-agnostic baseline; this repo is where domain-specific and heavier tooling lives instead, since it needs actual plugin machinery (manifests, shared assets, eventually hooks/MCP) that the baseline deliberately avoids. See baseline's `_architecture/plans/decisions/014-personal-plugin-marketplace-as-optional-extension-layer.md` for why.

## Structure

```
.claude-plugin/marketplace.json   # catalog: lists the plugins below
plugins/
└── jookoi-dev/                   # one broad plugin, not fragmented per-topic
    ├── .claude-plugin/plugin.json
    └── skills/
        ├── jookoi-paper-trail/       # copied from baseline, baseline stays canonical
        ├── jookoi-casual-writer/     # copied from baseline, baseline stays canonical
        └── jookoi-vue3-vibe-code/    # copied from baseline, baseline stays canonical
```

`jookoi-dev` groups related capability areas (writing conventions, memory system, framework-specific vibe-coding) under one installable plugin. Split a capability into its own plugin only when it needs independent distribution, versioning, or audience — not by default.

## Install

```
/plugin marketplace add <path-or-repo-url-to-this-repo>
/plugin install jookoi-dev@jookoi-ai-market
```

## Relationship to the baseline

- `JooKoi-developer-stack` works standalone with no knowledge this repo exists.
- The three skills currently here are copies, not moves — `jookoi-paper-trail` and `jookoi-casual-writer` remain baseline-universal skills whose source of truth is `JooKoi-developer-stack/my-global-setup/.agents/skills/`. Updates made there don't auto-propagate here; re-copy when a baseline skill changes and this plugin should pick it up.
- `jookoi-vue3-vibe-code` is domain-specific and was added directly here as this plugin's own content.
