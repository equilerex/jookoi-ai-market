#!/bin/sh
# jookoi-paper-trail — rehydrate after compaction, and at session start.
# Claude Code: SessionStart (matcher compact|startup|resume).
# Gemini CLI: SessionStart (source compress). Copilot CLI: onSessionStart.
# Spec: ../references/hooks.md

. "$(dirname -- "$0")/_common.sh"

OUT=""

for LAYER in "$ARCH" "$PRIV"; do
  [ -d "$LAYER" ] || continue
  FLAG=""
  [ "$LAYER" = "$PRIV" ] && FLAG="--private"
  NAME=$(basename "$LAYER")

  if [ -f "$LAYER/items.yaml" ]; then
    ITEMS=$(doc list --root "$REPO_ROOT" $FLAG 2>/dev/null)
    [ -n "$ITEMS" ] && OUT="$OUT
$NAME items (now, plus latest done):
$ITEMS
"
  fi
done

[ -z "$OUT" ] && exit 0

OUT="jookoi-paper-trail — working set:
$OUT
Change items only through the script (add/done/park/start/drop/edit/move), never by hand-editing items.yaml. Always name an item as id plus title, never a bare id. \`show <id>\` for a body, \`list --status=parked\` for the backlog, \`list --archived --last N\` for older items, \`find\` before adding. Do not read plans/decision-history/ unless a doc cites it or the user asks why."

# Start the local viewer if it is not running (idempotent, quiet). JOOKOI_VIEWER=0 turns this off.
if [ "$JOOKOI_VIEWER" != "0" ]; then
  VIEWER_URL=$(node "$SKILL_DIR/scripts/viewer/server.js" ensure 2>/dev/null)
  [ -n "$VIEWER_URL" ] && OUT="$OUT

Working-set viewer for every repo that uses this store: $VIEWER_URL . Give the user this link once at the start of the session."
fi

if [ -s "$PRIV/session-log.md" ]; then
  OUT="$OUT

Undrained raw notes at _jookoi-architecture/session-log.md. Read, fold what still matters into the store, clear it."
fi

emit_context "$OUT" "SessionStart"
exit 0
