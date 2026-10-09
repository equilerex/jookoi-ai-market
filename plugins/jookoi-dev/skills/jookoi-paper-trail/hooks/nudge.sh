#!/bin/sh
# jookoi-paper-trail — end-of-turn reminder, at most once per session.
# Claude Code: Stop. Gemini CLI: AfterAgent. Copilot CLI: Stop.
# Spec: ../references/hooks.md
#
# Silent unless this session changed enough files without a record, or an open plan
# looks finished. Fires once, then never again in that session. A reminder, not a gate.

. "$(dirname -- "$0")/_common.sh"

[ "$(field stop_hook_active)" = "true" ] && exit 0
[ -f "$ARCH/items.yaml" ] || [ -f "$PRIV/items.yaml" ] || exit 0

MSG=$(doc nudge --session "$(field session_id)" --root "$REPO_ROOT" 2>/dev/null)
[ -z "$MSG" ] && exit 0

emit_block "$MSG" "Stop"
exit 0
