# jookoi-ai-market

Active personal toolkit maintained by [Joosep Kõivistik](https://www.linkedin.com/in/jokoivi/), a frontend engineer based in Copenhagen. Built for his own workflow, shared in case it's useful elsewhere.

Personal plugin marketplace, an optional extension layer on top of [`JooKoi-developer-stack`](../JooKoi-developer-stack). That repo is the portable, harness-agnostic baseline. This repo holds domain-specific and heavier tooling that needs actual plugin machinery (manifests, shared assets, eventually hooks and MCP), which the baseline deliberately avoids. See baseline's `_architecture/plans/decisions/014-personal-plugin-marketplace-as-optional-extension-layer.md` for the reasoning.

## Skills

| Skill | What | Why |
|---|---|---|
| [`jookoi-paper-trail`](https://github.com/equilerex/JooKoi-developer-stack/tree/main/my-global-setup/.agents/skills/jookoi-paper-trail) | Writes decisions, plans, and open work into a repo's own `_architecture/` files instead of the chat transcript. Full CONTEXT.md / TODO.md / BACKLOG.md / decisions / archive pipeline documented at the link. | Nothing durable gets lost when a session ends or gets compacted. |
| [`jookoi-create-skill`](plugins/jookoi-dev/skills/jookoi-create-skill/SKILL.md) | Create or adapt personal cross-harness skills for `.agents/skills`, removing host assumptions, packaging, and syncing to targets. | New skills start portable, follow established structure, and get installed or linked across environments without ad hoc manual copies. |
| [`jookoi-write-like-a-person`](plugins/jookoi-dev/skills/jookoi-write-like-a-person/SKILL.md) | Tone rules for replies and people-facing text: emails, messages, non-technical explanations. Audience-neutral. | Portable across projects, shareable without an engineer-specific voice baked in. |
| [`jookoi-write-casual-technical`](plugins/jookoi-dev/skills/jookoi-write-casual-technical/SKILL.md) | Tone rules for technical `.md` documentation: README, architecture notes, another SKILL.md. Engineer voice. | Docs read like an engineer wrote them, not an assistant. |
| [`jookoi-md-design`](plugins/jookoi-dev/skills/jookoi-md-design/SKILL.md) | Design skill for `.md` files: layout, content blocks, spacing and visual flow, with a themed component library (hero, badges, feature grids, callouts, diagrams) and a badge catalogue. Agent-facing files get design through structure only. Pairs with `jookoi-write-casual-technical`, which owns the words. See its [README](plugins/jookoi-dev/skills/jookoi-md-design/README.md) for provenance. | Models write plain markdown fine on their own, but can't design a page: layouts come out as walls of text or a random badge wall. |
| [`jookoi-vue3-vibe-code`](plugins/jookoi-dev/skills/jookoi-vue3-vibe-code/SKILL.md) | Default architecture for a fast Vue 3 prototype: CDN-loaded, no build step, no `.vue` files. | Skips bundler setup for MVPs, dashboards, quick internal tools. |
| [`jookoi-angular-performance`](plugins/jookoi-dev/skills/jookoi-angular-performance/SKILL.md) | Audits and fixes Angular app performance: bundle budgets, lazy routes, `@defer`, images, OnPush/signals/zoneless, SSR/hydration, Core Web Vitals. Ships a zero-dependency static audit script. Baseline Angular 22, see its [README](plugins/jookoi-dev/skills/jookoi-angular-performance/README.md) for provenance. | Without it, "optimize this" gets OnPush sprinkled everywhere regardless of the real bottleneck, and APIs recommended by stale names. |
| [`jookoi-plan-review`](plugins/jookoi-dev/skills/jookoi-plan-review/SKILL.md) | Reviews an LLM-written feature implementation plan before coding: checks it against the codebase and reports blockers, gaps, and risks. | Plans that read well still break on real code. Catching it before implementation avoids wasted work. |
| [`jookoi-fastled`](plugins/jookoi-dev/skills/jookoi-fastled/SKILL.md) | Writing LED animations with FastLED that look good to a human, plus the filter chain for audio-reactive effects. See its [README](plugins/jookoi-dev/skills/jookoi-fastled/README.md) for provenance. | LED effect code generated without it is reliably ugly: full white, every pixel at saturation 255, `delay()` in the loop. None of those are API errors, so nothing catches them. |

## Structure

```
.claude-plugin/marketplace.json   # catalog: lists the plugins below
plugins/
└── jookoi-dev/                   # one broad plugin, not fragmented per-topic
    ├── .claude-plugin/plugin.json
    └── skills/
        ├── jookoi-paper-trail/            # copied from baseline, baseline stays canonical
        ├── jookoi-create-skill/           # copied from baseline, portable skill creation workflow
        ├── jookoi-write-like-a-person/    # audience-neutral tone, replies and people-facing text
        ├── jookoi-write-casual-technical/ # engineer voice, technical .md documentation
        ├── jookoi-md-design/              # design: layout, components, visual flow of .md files
        ├── jookoi-vue3-vibe-code/         # for fast prototypes with html, js and cdn.
        ├── jookoi-fastled/                # Led animation framework usage instructions to build aestetically pleasing effects
        ├── jookoi-angular-performance/    # Angular perf audit: measure, fix by symptom, version-aware
        └── jookoi-plan-review/            # review an LLM-written implementation plan against the codebase before coding
```

`jookoi-dev` groups related capability areas (writing conventions, memory system, framework-specific vibe-coding) under one installable plugin. A capability gets split into its own plugin only when it needs independent distribution, versioning, or audience, not by default.

## Install

**Claude Code:**

```
/plugin marketplace add equilerex/jookoi-ai-market
/plugin install jookoi-dev@jookoi-ai-market
```

**GitHub Copilot CLI:**

Copilot reads `.claude-plugin/marketplace.json` and `plugin.json` directly, they're already in its manifest search path. No separate manifest needed.

```
copilot plugin marketplace add https://github.com/equilerex/jookoi-ai-market
copilot plugin install jookoi-dev@jookoi-ai-market
```

**Gemini CLI:**

Installs `SKILL.md` skills straight from a git repo, one at a time, no packaging step:

```
gemini skills install https://github.com/equilerex/jookoi-ai-market --path plugins/jookoi-dev/skills/jookoi-paper-trail --consent
gemini skills install https://github.com/equilerex/jookoi-ai-market --path plugins/jookoi-dev/skills/jookoi-create-skill --consent
gemini skills install https://github.com/equilerex/jookoi-ai-market --path plugins/jookoi-dev/skills/jookoi-write-like-a-person --consent
gemini skills install https://github.com/equilerex/jookoi-ai-market --path plugins/jookoi-dev/skills/jookoi-write-casual-technical --consent
gemini skills install https://github.com/equilerex/jookoi-ai-market --path plugins/jookoi-dev/skills/jookoi-md-design --consent
gemini skills install https://github.com/equilerex/jookoi-ai-market --path plugins/jookoi-dev/skills/jookoi-vue3-vibe-code --consent
gemini skills install https://github.com/equilerex/jookoi-ai-market --path plugins/jookoi-dev/skills/jookoi-fastled --consent
gemini skills install https://github.com/equilerex/jookoi-ai-market --path plugins/jookoi-dev/skills/jookoi-angular-performance --consent
gemini skills install https://github.com/equilerex/jookoi-ai-market --path plugins/jookoi-dev/skills/jookoi-plan-review --consent
```

**Any other `SKILL.md`-reading harness:**

`SKILL.md` (name, description, body) is an open cross-tool standard, not Claude-specific. Copy whichever folder you want from `plugins/jookoi-dev/skills/` into wherever that harness reads local skills from. No generated repo-root `.agents/skills/`: it would shadow a same-named skill in the user's own global skills directory for any tool that discovers skills workspace-first.

## Relationship to the baseline

- `JooKoi-developer-stack` works standalone, with no knowledge this repo exists.
- Skills here are copies, not moves. Source of truth for baseline-universal ones (`jookoi-paper-trail`, `jookoi-create-skill`, `jookoi-write-like-a-person`, `jookoi-write-casual-technical`) is `JooKoi-developer-stack/my-global-setup/.agents/skills/`. Updates made there don't auto-propagate here, re-copy by hand when a baseline skill changes and this plugin should pick it up.
- `jookoi-md-design`, `jookoi-vue3-vibe-code`, `jookoi-fastled`, `jookoi-angular-performance`, and `jookoi-plan-review` are domain-specific, added directly here as this plugin's own content.
