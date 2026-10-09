#!/bin/sh
# jookoi-paper-trail — rehydrate after compaction, and at session start.
# Claude Code: SessionStart (matcher compact|startup|resume).
# Gemini CLI: SessionStart (source compress). Copilot CLI: onSessionStart.
# Also runs sweep, so unrecorded work from the previous session shows up once.
# Spec: ../references/hooks.md

. "$(dirname -- "$0")/_common.sh"

# Marks the session start, so the end-of-turn reminder counts only this session's work.
doc nudge --start --session "$(field session_id)" --root "$REPO_ROOT" >/dev/null 2>&1

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
    # Unrecorded work from the previous session surfaces here, once. Informational, never blocking.
    SWEEP=""; [ -z "$FLAG" ] && SWEEP=$(doc sweep --root "$REPO_ROOT" 2>/dev/null)
    case "$SWEEP" in
      ""|"sweep: nothing to flag"*|"sweep: skipped"*) ;;
      *) OUT="$OUT
$SWEEP
" ;;
    esac
  fi
done

[ -z "$OUT" ] && exit 0

OUT="jookoi-paper-trail — working set:
$OUT
This repo uses jookoi-paper-trail. Recording is part of the work, not a step after it: whenever a call is made (by the user or by you), a task starts or finishes, config or topology changes, or a doc goes wrong, use the skill and write it in that same turn. The next session knows only what is in these files. If you write a compaction summary, keep this paragraph in it.
One item per piece of work, never one per small change. Use the script for item changes (add/done/park/start/drop/edit/move). Hand-editing items.yaml is fine for merging or removing redundant entries, then run check. Always name an item as id plus title, never a bare id. \`show <id>\` for a body, \`list --status=parked\` for the backlog, \`list --archived --last N\` for older items, \`find\` before adding. Do not read archived-* paths (plans/archived-plans, plans/archived-decisions, archived-items) unless a doc links the file, an item names it, or the user asks."

# Start the local viewer if it is not running (idempotent, quiet). JOOKOI_VIEWER=0 turns this off.
if [ "$JOOKOI_VIEWER" != "0" ]; then
  VIEWER_URL=$(node "$SKILL_DIR/scripts/viewer/server.js" ensure 2>/dev/null)
  if [ -n "$VIEWER_URL" ]; then
    REPO_Q=$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$(basename "$REPO_ROOT")")
    OUT="$OUT

Working-set viewer for this repo: ${VIEWER_URL}?repo=${REPO_Q} . Give the user this link once at the start of the session."
  fi
fi

if [ -s "$PRIV/session-log.md" ]; then
  OUT="$OUT

Undrained raw notes at _jookoi-architecture/session-log.md. Read, fold what still matters into the store, clear it."
fi

emit_context "$OUT" "SessionStart"
exit 0
