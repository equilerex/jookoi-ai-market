#!/bin/sh
# jookoi-paper-trail — rehydrate after compaction, and at session start.
# Claude Code: SessionStart (matcher compact|startup|resume).
# Gemini CLI: SessionStart (source compress). Copilot CLI: onSessionStart.
# Spec: ../references/hooks.md

. "$(dirname -- "$0")/_common.sh"

TODO_FILE="$ARCH/TODO.md"
[ -f "$TODO_FILE" ] || TODO_FILE="$PRIV/TODO.md"
[ -f "$TODO_FILE" ] || exit 0

# Context: everything between its heading and the checklist heading.
CONTEXT=$(awk '/^## Context/{f=1;next} /^## Checklist/{f=0} f' "$TODO_FILE")

# Checklist: everything after its heading.
CHECKLIST=$(awk '/^## Checklist/{f=1;next} f' "$TODO_FILE")

OUT="jookoi-paper-trail — TODO.md:"
[ -n "$CONTEXT" ] && OUT="$OUT

Context:
$CONTEXT"

[ -n "$CHECKLIST" ] && OUT="$OUT

Checklist:
$CHECKLIST"

OUT="$OUT

Edit TODO.md directly as work happens -- check off items, add new ones, rewrite Context when it's stale. Nothing here is cleared automatically. \`jookoi-paper-trail flush\` archives it and resets it, on your own judgement -- never on a cadence, and never without first moving anything still relevant to BACKLOG.md."

if [ -s "$PRIV/session-log.md" ]; then
  OUT="$OUT

Undrained raw notes at _jookoi-architecture/session-log.md. Read, fold what still matters into TODO.md, clear it."
fi

emit_context "$OUT" "SessionStart"
exit 0
