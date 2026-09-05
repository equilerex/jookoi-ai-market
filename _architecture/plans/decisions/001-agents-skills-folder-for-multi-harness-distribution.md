# Decision 001 — agents-skills-folder-for-multi-harness-distribution

Date: 2026-09-05

Status: SUPERSEDED by [[002-claude-plugin-manifest-already-covers-copilot-and-gemini-ins]] — assumed Copilot CLI and Gemini CLI had no manifest/marketplace path of their own. Checked against live docs: Copilot CLI reads `.claude-plugin/marketplace.json`/`plugin.json` directly, and Gemini CLI installs `SKILL.md` skills straight from a git repo via `gemini skills install`. `.agents/skills/` and the sync script still exist, kept for a narrower reason (workspace-level discovery without an install step), not as a marketplace substitute.

<!-- Status is one of: DECIDED | TRIAL | REJECTED | DEFERRED | SUPERSEDED
     A superseding decision gets its own number. The superseded file's status changes
     and its body gains a pointer — it is never edited away or deleted.
     All five sections below are required. -->

## Problem

Skills here only installed through Claude Code's plugin marketplace (`.claude-plugin/marketplace.json` + `plugin.json`). User wants all tooling harness-agnostic — usable from Gemini CLI, VS Code Copilot, Codex, Cursor, etc., not just Claude Code.

## Options considered

- Per-harness manifest generator (JSON configs for each target harness, versioned/bumped together), following the pattern used by the `wshobson/agents` repo (bespoke Python/`uv` generator tied to their own eval framework, emitting harness-native artifacts per tool).
- Symlink `plugins/*/skills/*` into a shared folder.
- Plain verbatim copy of each skill folder into a root-level `.agents/skills/<name>/`, no manifest.

## Decision

Copy-script (`scripts/sync-agents-skills.js`) that mirrors `plugins/*/skills/*` into root `.agents/skills/<name>/` verbatim, pruning stale entries, and rerun by hand after adding/renaming/removing a skill. `plugins/jookoi-dev/skills/*` stays the Claude Code-canonical source.

## Why not the alternatives

Per-harness manifest generation solves a problem this repo doesn't have: `SKILL.md` (name + description + body) is already an open cross-tool standard (agentskills.io, originated by Anthropic) read natively by Gemini CLI, VS Code Copilot, Codex, and Cursor — no format translation needed, only the install/discovery layer differs per harness. Building a generator for content that needs no conversion is wasted machinery. `wshobson/agents`'s generator exists because their adapters emit genuinely harness-native artifacts (different file shapes per tool); that's not this repo's situation.

Symlinks ruled out: Windows requires dev mode or admin rights plus `core.symlinks=true` git config for symlinks to survive a clone reliably — fragile across machines this repo needs to work on.

## Next step

None outstanding — script exists, runs clean, README documents it. Re-run `node scripts/sync-agents-skills.js` whenever a skill is added, renamed, or removed under `plugins/*/skills/`.
