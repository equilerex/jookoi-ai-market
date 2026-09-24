# Hooks — keeping the working set current across three harnesses

Flush runs on model judgement only, never on a gate. What the hooks actually enforce is smaller: that the working set gets touched when work happened, so nothing is lost to a session that ends without an update.

The skill works without hooks. They are the enforcement layer where a harness supports them. Without them nothing shows the working set at session start and nothing checks at the end, so the skill depends on the model remembering. `jookoi-paper-trail hooks` reports which jobs are wired for each harness and marks the one running this session. `sweep` flags missing hooks for that harness.

## Which harness

The script detects the harness from the environment its shell inherits: `CLAUDECODE` for Claude Code, `GEMINI_CLI` for Gemini CLI. Copilot CLI has no reliable marker, so set `JOOKOI_HARNESS=copilot`. `JOOKOI_HARNESS` overrides detection everywhere. Undetected means no hooks are assumed.

## Check and wire

Read this when `sweep` or `hooks` reports missing hooks. Tell the user once, in one line, then:

1. Run `hooks`. It reads the Claude Code settings (`~/.claude/settings*.json`, the repo's `.claude/settings*.json`), the Gemini files (`~/.gemini/`, the repo's `.gemini/`) and Copilot's `hooks.json`.
2. If this session's harness shows `gate` or `rehydrate` as `no`, run `hooks --print` (or `hooks --print --harness=claude|gemini|copilot`) and merge the output into the target file it names. `--print` writes the commands with the path of the install that is running (`$HOME/.agents/...`, a plugin cache, anywhere), so use it rather than copying `hooks/config/*.json`, which assume `~/.agents`. Add to existing entries and never replace the file. Back it up, show the user the diff, and wait for approval: a global file changes every session on the machine.
3. Global wiring is the default where the harness has a global file (Claude Code's `~/.claude/settings.json`). The hooks exit silently in a repo with no `items.yaml`, so they are safe in every repo. Repo-level wiring works too, but has to be repeated per repo. Never wire both, or the gate runs twice.
4. Run `hooks` again to confirm. Hooks load at session start, so they take effect in the next session.

## Harnesses without hooks

Any harness other than the three above either has no lifecycle hooks or has hooks these scripts don't ship a config for yet. Check its current docs before adding one. Until then the model is the gate, and `hooks` and `sweep` say so:

- Run `list` at session start and `sweep` before ending any turn that changed files.
- Put the trigger in a file the harness does load. Most read `AGENTS.md`, so propose one line for the repo's `AGENTS.md`: "This repo uses jookoi-paper-trail: load the skill, run `list` at session start, and `sweep` before ending a turn that changed files."
- The `paper-trail:` trail line and the compaction-summary line in `SKILL.md` matter most here. With no rehydrate hook, they are the only path back after compaction.

The scripts are plain Node and POSIX `sh`, so they run under any harness that can execute shell commands.

Three scripts, one job each. All POSIX `sh`, all reading hook JSON on stdin, all emitting the calling harness's output shape from a single `emit` function.

| Job | Claude Code | Gemini CLI | GitHub Copilot CLI |
|---|---|---|---|
| Gate the end of a turn | `Stop` | `AfterAgent` | `Stop` |
| Preserve before compaction | `PreCompact` | `PreCompress` | — (no auto-compaction loop) |
| Rehydrate after compaction | `SessionStart` matcher `compact` | `SessionStart` source `compress` | — |
| Rehydrate on a new session | `SessionStart` matcher `startup`/`resume` | `SessionStart` | `onSessionStart` |
| Config location | `.claude/settings.json` | `.gemini/hooks/hooks.json` (v0.26.0+) | `hooks.json`, or `joinSession()` via `@github/copilot-sdk/extension` |

Copy-in fragments for each live in `hooks/config/`.

---

## `doc-gate.sh` — the update gate

Blocks the end of a turn once, with the findings of `sweep --gate`, when work happened after the last record. It never asks for a flush — flush is not this gate's business.

Blocks only when **all** hold:

1. the harness is not already mid-block (`stop_hook_active` is not `true`);
2. the repo has an `items.yaml` in either layer, so global wiring stays silent elsewhere;
3. an uncommitted file outside the docs (`_architecture/`, `_jookoi-architecture/`, `CONTEXT.md`, `AGENTS.md`, `CLAUDE.md`) is newer than the last record, meaning the later of the last `items.yaml` write and the last `sweep --ack`;
4. that record is older than the quiet window, `JOOKOI_GATE_QUIET_MIN` (default 10 minutes), so a session that records as it goes is not stopped every turn.

A store write or `sweep --ack` clears condition 3, so the gate is self-clearing and cannot loop on itself. It compares file times rather than asking "is `items.yaml` dirty", because a store edited once early in a session stays dirty until the commit and would silence the gate for the rest of the session. The ack lives in `~/.jookoi-paper-trail/ack/`, outside the repo.

No `SubagentStop`: subagents don't own the working set, and blocking them would push store writes into agents that lack the session's context.

**Condition 1 is not optional.** Without it the gate blocks every turn up to Claude Code's cap (8 by default, `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`), and on a harness with no cap it hangs the session outright.

**Unverified — check before relying on it.** Claude Code's `Stop` documents `decision: "block"` with `additionalContext`. Whether Gemini's `AfterAgent` and Copilot's `Stop` support a blocking decision has not been confirmed against their current docs. Where blocking is unavailable the script degrades: it writes the reminder to `_jookoi-architecture/session-log.md` and the next `SessionStart` surfaces it. That path is strictly weaker — the reminder arrives one session late — so verify blocking support rather than assuming the fallback is fine.

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

The fragments in `hooks/config/` are ready to merge: `claude-code.json` into `~/.claude/settings.json`, `gemini.json` into `.gemini/hooks/hooks.json`, `copilot.json` into the repo's `hooks.json`. Commands point at `$HOME/.agents/skills/jookoi-paper-trail/hooks/`, the installed copy, never a path inside the repo.

No hook on any harness can invoke a skill by name. The gate injects an instruction to update the working set; the model does the actual edit. Design accordingly — the injected text has to stand on its own.

Registration is a manual merge, done by the agent with the user's approval. No setup script.
