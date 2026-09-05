# TODO
<!-- Live working set. `jookoi-paper-trail flush` archives it and resets it. See AGENTS.md. -->

## Context

Repo is a personal plugin marketplace, one plugin (`jookoi-dev`) under `plugins/jookoi-dev/`. Skills there are copies of baseline (`JooKoi-developer-stack`) skills, not moves — re-copy by hand when baseline changes. Not Claude-specific by intent: goal is harness-agnostic, usable from Claude Code, Gemini CLI, etc.

`jookoi-write-like-a-person` and `jookoi-write-casual-technical` split by audience/purpose, not file type: the former triggers on replies to the user and text meant for other people (even if saved as `.md`); the latter triggers on technical documentation `.md` files (README, architecture notes, SKILL.md) that aren't themselves a reply. Each description references the other as "prefer X when installed" so neither breaks if only one ships.

Multi-harness finding (verified against live docs, not just inferred): `SKILL.md` is portable as-is, no conversion needed. Copilot CLI reads `.claude-plugin/marketplace.json` + `plugin.json` directly (in its own manifest search order) — this repo's existing manifests already serve it, no duplicate needed. Gemini CLI installs `SKILL.md` skills straight from a git repo via `gemini skills install <url> --path <skill-dir> --consent`, no packaging step. No generated repo-root `.agents/skills/`: it would shadow same-named skills in the user's global `~/.agents/skills/` for any tool that discovers skills workspace-first. Anyone on a workspace-discovery-only tool copies the one skill folder they want by hand instead.

## Checklist

- [x] Set up `_architecture/` paper trail (TODO/BACKLOG/ARCHITECTURE/archive).
- [x] Split `write-like-a-person` / `write-casual-technical` trigger descriptions (audience vs .md-file, graceful cross-reference when only one is installed).
- [x] Fix `.gitignore` ignoring root `.claude-plugin/` — was blocking the marketplace manifest from ever being committed/pushed.
- [x] Multi-harness install researched and verified: Copilot CLI needs nothing extra (reads `.claude-plugin/` already), Gemini CLI installs via `gemini skills install`. Generated `.agents/skills/` folder built then dropped (shadow-risk against the user's global `~/.agents/skills/`). Decision trail: `plans/decisions/001` (superseded) → `002` (Copilot/Gemini findings) → `003` (drop the generated folder). README's Install section reflects the final state.
- [x] Fixed the stale README `## Structure` block (still listed removed `jookoi-casual-writer`, missing the write-like-a-person/write-casual-technical split) while touching Install.
