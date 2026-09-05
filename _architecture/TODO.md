# TODO
<!-- Live working set. `jookoi-paper-trail flush` archives it and resets it. See AGENTS.md. -->

## Context

Repo is a personal plugin marketplace, one plugin (`jookoi-dev`) under `plugins/jookoi-dev/`. Skills there are copies of baseline (`JooKoi-developer-stack`) skills, not moves — re-copy by hand when baseline changes. Not Claude-specific by intent: goal is harness-agnostic, usable from Claude Code, Gemini CLI, etc.

`jookoi-write-like-a-person` and `jookoi-write-casual-technical` split by audience/purpose, not file type: the former triggers on replies to the user and text meant for other people (even if saved as `.md`); the latter triggers on technical documentation `.md` files (README, architecture notes, SKILL.md) that aren't themselves a reply. Each description references the other as "prefer X when installed" so neither breaks if only one ships.

Multi-harness finding: `SKILL.md` (name + description + body, optional `scripts/`/`references/`/`assets/`) is an open standard (agentskills.io, originated by Anthropic) natively read by Gemini CLI, Cursor, Copilot/VS Code, Codex, and more — skill content needs no conversion to be portable. Only `.claude-plugin/marketplace.json` + `plugin.json` (the install/discovery layer) is Claude Code-specific; other harnesses use their own thin adapter (e.g. Gemini CLI reads skills from `.gemini/skills/`, no manifest needed for plain skills).

## Checklist

- [x] Set up `_architecture/` paper trail (TODO/BACKLOG/ARCHITECTURE/archive).
- [x] Split `write-like-a-person` / `write-casual-technical` trigger descriptions (audience vs .md-file, graceful cross-reference when only one is installed).
- [x] Fix `.gitignore` ignoring root `.claude-plugin/` — was blocking the marketplace manifest from ever being committed/pushed.
- [x] Build multi-harness distribution: `scripts/sync-agents-skills.js` copies `plugins/*/skills/*` verbatim into root `.agents/skills/`, the manifest-free convention Gemini CLI and VS Code Copilot read natively. README's Install section documents it. Decision logged as `plans/decisions/001-agents-skills-folder-for-multi-harness-distribution.md`.
- [x] Fixed the stale README `## Structure` block (still listed removed `jookoi-casual-writer`, missing the write-like-a-person/write-casual-technical split) while touching Install.
