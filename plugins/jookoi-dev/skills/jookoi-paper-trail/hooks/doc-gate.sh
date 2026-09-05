#!/bin/sh
# jookoi-paper-trail — end-of-turn TODO.md update gate.
# Claude Code: Stop, SubagentStop. Gemini CLI: AfterAgent. Copilot CLI: Stop, AgentStop.
# Spec: ../references/hooks.md
#
# Blocks once, with instructions, when the tree is dirty but TODO.md wasn't touched.
# Never asks for a flush -- flush is model-judgement only, not gated.
# Self-clearing: touching TODO.md removes the reason to block.

. "$(dirname -- "$0")/_common.sh"

# 1. Already mid-block. Exiting here is what stops the gate looping.
[ "$(field stop_hook_active)" = "true" ] && exit 0

# 2. Nothing changed on disk -- nothing worth recording.
STATUS_PORCELAIN=$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null)
[ -z "$STATUS_PORCELAIN" ] && exit 0

# 3. TODO.md already modified this session.
printf '%s\n' "$STATUS_PORCELAIN" | grep -q 'TODO\.md' && exit 0

emit_block "Working tree is dirty but TODO.md hasn't been touched this session. Before ending: update it -- check off finished items, add anything new, rewrite the Context header if it's stale. Not a request to flush; flush runs only on your own judgement. See the jookoi-paper-trail skill." "Stop"
exit 0
