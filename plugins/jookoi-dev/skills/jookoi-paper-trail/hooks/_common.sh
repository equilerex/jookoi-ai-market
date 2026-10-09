#!/bin/sh
# jookoi-paper-trail hooks — shared helpers.
# Spec: ../references/hooks.md
#
# Sourced by preserve.sh and rehydrate.sh. POSIX sh, no bashisms.

HOOK_INPUT=$(cat)

SKILL_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
ARCH="$REPO_ROOT/_architecture"
PRIV="$REPO_ROOT/_jookoi-architecture"
# A function, not a string, so a skill path with spaces (C:UsersFirst Last) survives.
doc() { node "$SKILL_DIR/scripts/jookoi-paper-trail.js" "$@"; }

# Which harness are we running under. Override with JOOKOI_HARNESS.
harness() {
  if [ -n "$JOOKOI_HARNESS" ]; then printf '%s' "$JOOKOI_HARNESS"; return; fi
  if [ -n "$CLAUDE_SESSION_ID" ] || [ -n "$CLAUDE_PROJECT_DIR" ]; then printf 'claude'; return; fi
  if [ -n "$GEMINI_CLI_SESSION_ID" ] || [ -n "$GEMINI_CLI" ]; then printf 'gemini'; return; fi
  if [ -n "$COPILOT_SESSION_ID" ] || [ -n "$COPILOT_CLI" ]; then printf 'copilot'; return; fi
  printf 'claude'
}

# Read a top-level string field out of the hook JSON on stdin. jq when present,
# grep/sed otherwise -- these are all flat scalar fields, so the cheap path holds.
field() {
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$HOOK_INPUT" | jq -r --arg k "$1" '.[$k] // empty' 2>/dev/null
  else
    printf '%s' "$HOOK_INPUT" \
      | tr ',' '\n' \
      | grep "\"$1\"" \
      | head -1 \
      | sed 's/.*: *//; s/^"//; s/"$//; s/[}[:space:]]*$//'
  fi
}

json_escape() {
  sed 's/\\/\\\\/g; s/"/\\"/g' | awk '{printf "%s\\n", $0}'
}

# Emit context back to the model. $1 = text, $2 = event name.
emit_context() {
  _text=$(printf '%s' "$1" | json_escape)
  case "$(harness)" in
    claude|gemini)
      printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":"%s"}}\n' "$2" "$_text"
      ;;
    copilot)
      printf '{"additionalContext":"%s"}\n' "$_text"
      ;;
  esac
}

# Ask the model for one more turn before it stops. $1 = text, $2 = event name.
# Claude Code Stop and Gemini AfterAgent honour {"decision":"block"}. Copilot's
# Stop is unverified, so there the text is printed as context only.
emit_block() {
  _text=$(printf '%s' "$1" | json_escape)
  case "$(harness)" in
    claude|gemini) printf '{"decision":"block","reason":"%s"}\n' "$_text" ;;
    copilot) emit_context "$1" "$2" ;;
  esac
}
