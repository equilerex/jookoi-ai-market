#!/bin/sh
# jookoi-paper-trail — end-of-turn working-set update gate.
# Claude Code: Stop. Gemini CLI: AfterAgent. Copilot CLI: Stop.
# Spec: ../references/hooks.md
#
# Blocks once, with the sweep's findings, when files changed after the last
# working-set write or acknowledgement. Never asks for a flush -- flush is
# model-judgement only. Self-clearing: a store write or `sweep --ack` resets it.

. "$(dirname -- "$0")/_common.sh"

# 1. Already mid-block. Exiting here is what stops the gate looping.
[ "$(field stop_hook_active)" = "true" ] && exit 0

# 2. Not a paper-trail repo. Wired globally, the gate must stay silent elsewhere.
[ -f "$ARCH/items.yaml" ] || [ -f "$PRIV/items.yaml" ] || exit 0

# 3. The sweep decides: it prints nothing unless work is newer than the last record
#    and the quiet window (JOOKOI_GATE_QUIET_MIN, default 10) has passed.
FINDINGS=$(doc sweep --gate --root "$REPO_ROOT" 2>/dev/null)
[ -z "$FINDINGS" ] && exit 0

emit_block "jookoi-paper-trail: work changed since the working set was last updated. Before ending, deal with each point below: record it through the jookoi-paper-trail script (add/edit/done, CONTEXT.md, plan, decision), or run \`sweep --ack\` if nothing is worth recording. Not a request to flush.

$FINDINGS" "Stop"
exit 0
