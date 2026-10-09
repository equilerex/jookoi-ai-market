# Hooks — session boundaries across three harnesses

Hooks act at session boundaries, plus one end-of-turn reminder that fires at most once per session. An earlier per-turn gate blocked whenever unrecorded files piled up, fired in every long session, and pushed agents to log small changes just to clear it. `SessionEnd` cannot replace it: it runs during shutdown, after the agent is done, so it can write to disk but cannot ask the agent for anything.

The resulting split:

- **`nudge.sh` on `Stop`**: at most one reminder per session, and only when this session changed 8 or more files (`JOOKOI_NUDGE_MIN_FILES`) without a record, or an open plan looks finished (status done, or every Deliverables box ticked). Files left over from earlier sessions do not count. Once fired it stays quiet for the rest of the session, whatever the agent does.
- **`preserve.sh` on `PreCompact` and `SessionEnd`**: raw notes to `_jookoi-architecture/session-log.md`.
- **`rehydrate.sh` on `SessionStart`**: the working set, `sweep` findings (unrecorded work, finished plans) and undrained notes, so whatever the last session missed is picked up by the next one.

The skill works without hooks. Without them nothing shows the working set at session start, so the skill depends on the model remembering. `jookoi-paper-trail hooks` reports which jobs are wired for each harness and marks the one running this session. `sweep` flags missing hooks for that harness.

## Which harness

The script detects the harness from the environment its shell inherits: `CLAUDECODE` for Claude Code, `GEMINI_CLI` for Gemini CLI. Copilot CLI has no reliable marker, so set `JOOKOI_HARNESS=copilot`. `JOOKOI_HARNESS` overrides detection everywhere. Undetected means no hooks are assumed.

## Check and wire

Read this when `sweep` or `hooks` reports missing hooks. Tell the user once, in one line, then:

1. Run `hooks`. It reads the Claude Code settings (`~/.claude/settings*.json`, the repo's `.claude/settings*.json`), the Gemini files (`~/.gemini/`, the repo's `.gemini/`) and Copilot's `hooks.json`.
2. If this session's harness shows `rehydrate` as `no` (or `sessionEnd` as `no`, which is optional), run `hooks --print` (or `hooks --print --harness=claude|gemini|copilot`) and merge the output into the target file it names. `--print` writes the commands with the path of the install that is running (`$HOME/.agents/...`, a plugin cache, anywhere), so use it rather than copying `hooks/config/*.json`, which assume `~/.agents`. Add to existing entries and never replace the file. Back it up, show the user the diff, and wait for approval: a global file changes every session on the machine.
3. Global wiring is the default where the harness has a global file (Claude Code's `~/.claude/settings.json`). The hooks exit silently in a repo with no `items.yaml`, so they are safe in every repo. Repo-level wiring works too, but has to be repeated per repo. Never wire both, or the hooks run twice.
4. If an older merge left a `Stop` (Claude Code, Copilot) or `AfterAgent` (Gemini) entry that runs `doc-gate.sh`, replace it with the `nudge.sh` entry. `doc-gate.sh` no longer exists.
5. Run `hooks` again to confirm. Hooks load at session start, so they take effect in the next session.

## Harnesses without hooks

Any harness other than the three above either has no lifecycle hooks or has hooks these scripts don't ship a config for yet. Check its current docs before adding one. Until then the model is the gate, and `hooks` and `sweep` say so:

- Run `list` and `sweep` at session start.
- Put the trigger in a file the harness does load. Most read `AGENTS.md`, so propose one line for the repo's `AGENTS.md`: "This repo uses jookoi-paper-trail: load the skill, and run `list` and `sweep` at session start."
- The `paper-trail:` trail line and the compaction-summary line in `SKILL.md` matter most here. With no rehydrate hook, they are the only path back after compaction.

The scripts are plain Node and POSIX `sh`, so they run under any harness that can execute shell commands.

Three scripts, one job each. All POSIX `sh`, both reading hook JSON on stdin, emitting the calling harness's output shape from `emit_context`.

| Job | Claude Code | Gemini CLI | GitHub Copilot CLI |
|---|---|---|---|
| Preserve before compaction | `PreCompact` | `PreCompress` | — (no auto-compaction loop) |
| Preserve at session end | `SessionEnd` | `SessionEnd` | `sessionEnd` |
| Rehydrate after compaction | `SessionStart` matcher `compact` | `SessionStart` source `compress` | — |
| Rehydrate on a new session | `SessionStart` matcher `startup`/`resume` | `SessionStart` | `onSessionStart` |
| Once-per-session reminder | `Stop` | `AfterAgent` | `Stop` (blocking unverified, sent as context) |
| Verified | Claude Code docs | Gemini CLI docs (`hooks.SessionEnd`), 09-10-2026 | Copilot CLI docs (`sessionEnd`, once per interactive session), 09-10-2026 |
| Config location | `.claude/settings.json` | `.gemini/hooks/hooks.json` (v0.26.0+) | `hooks.json`, or `joinSession()` via `@github/copilot-sdk/extension` |

Copy-in fragments for each live in `hooks/config/`.

---

## `preserve.sh` — before compaction and at session end

`PreCompact` receives the **entire uncompacted transcript on stdin**. It cannot inject anything back, and it does not need to: its job is to get to disk what compaction is about to throw away. `SessionEnd` runs the same script, so a session that ends with work never written down leaves a record for the next one.

Appends to `_jookoi-architecture/session-log.md`: timestamp, branch, `git status --short`, and a pointer to the transcript.

That file is a coarse recovery record, separate from the store and separate from the flush pipeline. It exists for the rarer case where the transcript held context the store never captured. Drain it by reading it, folding what still matters into the store, then clearing it.

---

## `rehydrate.sh` — after compaction, and at session start

`SessionStart` fires after the context has shrunk and **can** inject. It emits, as `additionalContext`:

- the `list` output (now items plus the latest done), for each layer;
- the plain `sweep` result, so unrecorded work from the previous session surfaces once, at the start of the next. Informational, never blocking;
- a one-line notice if `_jookoi-architecture/session-log.md` has undrained content;
- the viewer link for this repo (`?repo=` plus the folder name, `references/viewer.md`), after starting the viewer if it is not running, with an instruction to give it to the user once. `JOOKOI_VIEWER=0` skips this;
- pointers, no rules content: one item per piece of work, script for item changes (hand-editing is fine for merging or removing redundant entries, then `check`), name items as `id title`, `show <id>` for a body, `list --archived --last N` for older items, `find` before adding, and do not read `archived-*` paths unless a doc links the file, an item names it, or the user asks.


Matching on the compaction source keeps a fresh startup from paying for a rehydrate it does not need — but injecting on `startup` and `resume` too is cheap and means a cold session begins with the working set already in hand.

---

## Registering

The fragments in `hooks/config/` are ready to merge: `claude-code.json` into `~/.claude/settings.json`, `gemini.json` into `.gemini/hooks/hooks.json`, `copilot.json` into the repo's `hooks.json`. Each adds `SessionEnd` and drops the old end-of-turn entry. Commands point at `$HOME/.agents/skills/jookoi-paper-trail/hooks/`, the installed copy, never a path inside the repo.

No hook on any harness can invoke a skill by name. The injected text has to stand on its own: the model does the actual edit.

Registration is a manual merge, done by the agent with the user's approval. No setup script.
