# Hooks — keeping the working set current across three harnesses

Flush runs on model judgement only, never on a gate. What the hooks actually enforce is smaller: that the working set gets touched when work happened, so nothing is lost to a session that ends without an update.

Three scripts, one job each. All POSIX `sh`, all reading hook JSON on stdin, all emitting the calling harness's output shape from a single `emit` function.

| Job | Claude Code | Gemini CLI | GitHub Copilot CLI |
|---|---|---|---|
| Gate the end of a turn | `Stop`, `SubagentStop` | `AfterAgent` | `Stop`, `AgentStop` |
| Preserve before compaction | `PreCompact` | `PreCompress` | — (no auto-compaction loop) |
| Rehydrate after compaction | `SessionStart` matcher `compact` | `SessionStart` source `compress` | — |
| Rehydrate on a new session | `SessionStart` matcher `startup`/`resume` | `SessionStart` | `onSessionStart` |
| Config location | `.claude/settings.json` | `.gemini/hooks/hooks.json` (v0.26.0+) | `hooks.json`, or `joinSession()` via `@github/copilot-sdk/extension` |

Copy-in fragments for each live in `hooks/config/`.

---

## `doc-gate.sh` — the update gate

Blocks the end of a turn once, with instructions, when work happened but the working set wasn't touched. It never asks for a flush — flush is not this gate's business.

Blocks only when **all three** hold:

1. the harness is not already mid-block (`stop_hook_active` is not `true`);
2. `git status --porcelain` is non-empty — a session that changed nothing has nothing to record;
3. `items.yaml` has no uncommitted modification this session.

Touching `items.yaml` clears condition 3, so the gate is self-clearing and cannot loop on itself. The nudge is "update the store," not "flush" — a session can update the store every turn and never flush for days, and that is the intended steady state.

**Condition 1 is not optional.** Without it the gate blocks every turn up to Claude Code's cap (8 by default, `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`), and on a harness with no cap it hangs the session outright.

**Unverified — check before relying on it.** Claude Code's `Stop` documents `decision: "block"` with `additionalContext`. Whether Gemini's `AfterAgent` and Copilot's `Stop`/`AgentStop` support a blocking decision has not been confirmed against their current docs. Where blocking is unavailable the script degrades: it writes the reminder to `_jookoi-architecture/session-log.md` and the next `SessionStart` surfaces it. That path is strictly weaker — the reminder arrives one session late — so verify blocking support rather than assuming the fallback is fine.

---

## `preserve.sh` — before compaction

`PreCompact` receives the **entire uncompacted transcript on stdin**. It cannot inject anything back, and it does not need to: its job is to get to disk what compaction is about to throw away.

Appends to `_jookoi-architecture/session-log.md`: timestamp, branch, `git status --short`, and anything from the transcript that has not reached the store.

That file is a coarse recovery record, separate from the store and separate from the flush pipeline. It exists for the rarer case where the transcript held context the store never captured. Drain it by reading it, folding what still matters into the store, then clearing it.

---

## `rehydrate.sh` — after compaction, and at session start

`SessionStart` fires after the context has shrunk and **can** inject. It emits, as `additionalContext`:

- the `list` output (now items plus the latest done), for each layer;
- a one-line notice if `_jookoi-architecture/session-log.md` has undrained content;
- the viewer link, after starting the viewer if it is not running (`references/viewer.md`), with an instruction to give it to the user once. `JOOKOI_VIEWER=0` skips this;
- pointers, no rules content: change items only through the script, name items as `id title`, `show <id>` for a body, `list --archived --last N` for older items, `find` before adding, and do not read `plans/decision-history/` unless a doc cites it or the user asks why.


Matching on the compaction source keeps a fresh startup from paying for a rehydrate it does not need — but injecting on `startup` and `resume` too is cheap and means a cold session begins with the working set already in hand.

---

## Registering

Claude Code, in `.claude/settings.json` — merge, do not replace:

```json
{
  "hooks": {
    "Stop": [
      { "hooks": [{ "type": "command", "command": "sh .agents/skills/jookoi-paper-trail/hooks/doc-gate.sh" }] }
    ],
    "PreCompact": [
      { "hooks": [{ "type": "command", "command": "sh .agents/skills/jookoi-paper-trail/hooks/preserve.sh" }] }
    ],
    "SessionStart": [
      { "matcher": "compact|startup|resume",
        "hooks": [{ "type": "command", "command": "sh .agents/skills/jookoi-paper-trail/hooks/rehydrate.sh" }] }
    ]
  }
}
```

No hook on any harness can invoke a skill by name. The gate injects an instruction to update the working set; the model does the actual edit. Design accordingly — the injected text has to stand on its own.

Registration is manual copy, deliberately. No setup script.
