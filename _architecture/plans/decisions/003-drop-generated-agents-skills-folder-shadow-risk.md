# Decision 003 — drop-generated-agents-skills-folder-shadow-risk

Date: 2026-09-06

Status: DECIDED

<!-- Status is one of: DECIDED | TRIAL | REJECTED | DEFERRED | SUPERSEDED
     A superseding decision gets its own number. The superseded file's status changes
     and its body gains a pointer — it is never edited away or deleted.
     All five sections below are required. -->

## Problem

Decision 002 kept `.agents/skills/` and `scripts/sync-agents-skills.js` as a narrower fallback for tools that discover skills workspace-first with no install command. Not weighed at the time: these same skills already live in the user's global `~/.agents/skills/` (baseline `JooKoi-developer-stack`). A repo-root `.agents/skills/` would take precedence for any tool scanning this workspace, silently shadowing the maintained global copy with this repo's possibly-stale one.

## Options considered

- Keep the generated folder, accept the shadowing risk.
- Keep it but gitignore it / document the risk.
- Drop it entirely; anyone on a workspace-discovery-only tool copies the one skill they want by hand.

## Decision

Dropped `scripts/sync-agents-skills.js` and `.agents/skills/` entirely. Manual copy replaces it, same as this repo already does for its baseline-sourced skills (see `## Relationship to the baseline` in README).

## Why not the alternatives

Nobody actually needs the generated folder: a workspace-discovery tool user who wants one skill copies that one folder, same effort as running the sync script and checking the result. Keeping it either live or gitignored still leaves the shadow risk the moment anyone regenerates it locally and opens this repo in a tool that reads `.agents/skills/` ahead of their global skill directory.

## Next step

None. Supersedes the `.agents/skills/` half of [[002-claude-plugin-manifest-already-covers-copilot-and-gemini-ins]] — that decision's Copilot/Gemini install findings still stand, only its "keep the sync script for workspace discovery" conclusion is reversed here.
