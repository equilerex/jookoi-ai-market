#!/bin/sh
# jookoi-paper-trail — preserve before compaction.
# Claude Code: PreCompact. Gemini CLI: PreCompress. Copilot CLI: n/a.
# Spec: ../references/hooks.md
#
# PreCompact gets the entire uncompacted transcript on stdin and cannot inject
# anything back. Its only job is getting to disk what compaction discards.

. "$(dirname -- "$0")/_common.sh"

mkdir -p "$PRIV"
LOG="$PRIV/session-log.md"

[ -f "$LOG" ] || printf '# Session log — raw, undrained\n<!-- Written by preserve.sh. Not a pipeline stage: read it, route what matters, clear it. -->\n' > "$LOG"

{
  printf '\n## %s — pre-compaction snapshot\n\n' "$(date +%Y-%m-%d)"
  printf 'Time: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'Branch: %s\n' "$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || printf 'unknown')"
  printf 'Session: %s\n\n' "$(field session_id)"
  printf '```\n'
  git -C "$REPO_ROOT" status --short 2>/dev/null | head -60
  printf '```\n'
} >> "$LOG"

# The transcript itself is not copied wholesale -- it is large and mostly noise.
# What is kept is the pointer, so a later session can go back to it if needed.
TRANSCRIPT=$(field transcript_path)
[ -n "$TRANSCRIPT" ] && printf '\nTranscript: %s\n' "$TRANSCRIPT" >> "$LOG"

exit 0
