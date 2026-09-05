# Decision 002 — claude-plugin-manifest-already-covers-copilot-and-gemini-installs-direct

Date: 2026-09-06

Status: DECIDED — Copilot/Gemini install findings still stand. Its "keep `.agents/skills/` for workspace discovery" conclusion is reversed by [[003-drop-generated-agents-skills-folder-shadow-risk]] (shadows the user's global `~/.agents/skills/`).

<!-- Status is one of: DECIDED | TRIAL | REJECTED | DEFERRED | SUPERSEDED
     A superseding decision gets its own number. The superseded file's status changes
     and its body gains a pointer — it is never edited away or deleted.
     All five sections below are required. -->

## Problem

Decision 001 assumed Gemini CLI and Copilot CLI have no marketplace/catalog concept, so it built `scripts/sync-agents-skills.js` to copy skills into `.agents/skills/` as the distribution path for them. That assumption was wrong, checked against current docs.

## Options considered

Re-verified via docs.github.com and geminicli.com (superseded decision 001's research was not checked against live docs, only inferred).

- Copilot CLI's plugin manifest search order: `.plugin/plugin.json`, `plugin.json`, `.github/plugin/plugin.json`, `.claude-plugin/plugin.json`. Marketplace search order includes `.claude-plugin/marketplace.json`. It reads the same files already at this repo's root.
- Gemini CLI has `gemini skills install <git-url> --consent`, installing `SKILL.md`-based skills straight from a repo (optionally `--path` for a subdirectory). Separately, it discovers `.agents/skills/` and `.gemini/skills/` in-place at the workspace level, no install step.

## Decision

No per-harness manifest is missing. `.claude-plugin/marketplace.json` + `plugin.json` already serve Claude Code and Copilot CLI both. Gemini CLI installs directly from this repo via `gemini skills install`, no packaging needed.

`scripts/sync-agents-skills.js` and `.agents/skills/` are kept, but reframed: they're not a marketplace substitute, they're for Gemini CLI's (and similar tools') workspace-level discovery without a full install step — a smaller, real use case, not the one 001 was built to solve.

## Why not the alternatives

001's `.github/plugin/marketplace.json` duplication (considered, not yet built) would have been dead weight — Copilot already reads `.claude-plugin/marketplace.json`. Building a `gemini-extension.json` wrapper was also unnecessary: Gemini's skill install path doesn't need extension packaging unless the package needs actual extension features (MCP servers, hooks) beyond a plain skill.

## Next step

None outstanding. `.claude-plugin/` stays the single shared manifest for Claude Code + Copilot CLI. `.agents/skills/` stays for workspace-discovery-only tools. README's Install section needs a line correcting the Copilot/Gemini framing — Copilot needs no separate step, Gemini installs via `gemini skills install <repo-url>` rather than only reading the synced folder.
