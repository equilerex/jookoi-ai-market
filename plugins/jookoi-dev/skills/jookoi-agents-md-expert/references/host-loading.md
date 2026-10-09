# Host loading behavior

Read when deciding which filename a host reads, how nested files load, or where the global file lives. Snapshot from vendor docs, 2026-08. Re-check the vendor doc before promising behavior to the user.

| Host | Reads `AGENTS.md` | Nested discovery | Precedence | Global file |
|---|---|---|---|---|
| Claude Code | No. Reads `CLAUDE.md`. Bridge with `@AGENTS.md` import or symlink | Ancestors at launch, subdirs lazily | Concatenated root to cwd | `~/.claude/CLAUDE.md` |
| Codex CLI | Yes | Root to cwd, one file per dir | Nearer file later. `AGENTS.override.md` checked first | `~/.codex/AGENTS.md` |
| Cursor | Yes, root and nested | Yes | Nested overrides parent. Team, project, user rules merged | UI user rules |
| GitHub Copilot (IDE, coding agent) | Yes, with nested | Yes | Not documented | Web, CLI, JetBrains only |
| Copilot CLI | Yes | Yes | Explicitly none | `$HOME/.copilot/` |
| Gemini CLI | Only with `context.fileName` config | Yes | Concatenated | `~/.gemini/GEMINI.md` |
| opencode | Yes, preferred over `CLAUDE.md` | Walks up from cwd | Nearest `AGENTS.md`, then global, then `CLAUDE.md` | `~/.config/opencode/AGENTS.md` |
| Amp | Yes | Ancestors always, subtree on file access | Per-directory fallback | `$HOME/.config/amp/AGENTS.md` |
| Zed | Yes, ranked below other filenames | Worktree root only | First match wins | Rules Library |
| Cline | Yes | Workspace plus global | Workspace wins | `~/Documents/Cline/Rules` |
| Windsurf / Cascade | Yes | Per directory | Not documented | Not documented |
| Google Jules | Yes | Root only | n/a | Not documented |
| Aider | No auto-discovery | n/a | n/a | `--read` or config only |

Claude Code specifics:

- `@path` imports expand at launch and count toward always-loaded size.
- Root `CLAUDE.md` is re-read after `/compact`. Nested files and `paths:`-scoped rules reload only when matching files are read.
- `CLAUDE.local.md` is the gitignored personal variant. It exists only in the worktree where it was created. Share across worktrees with an `@~/...` import.
- `claudeMdExcludes` setting skips ancestor files from other teams in a monorepo.

Local-override files outside Claude Code and Codex (`AGENTS.local.md` and similar) are convention, not tooling. Most hosts do not read them.

Vendor docs to re-check against: [Claude Code](https://code.claude.com/docs/en/memory), [Cursor](https://cursor.com/docs/context/rules), [GitHub Copilot](https://docs.github.com/copilot), [Gemini CLI](https://github.com/google-gemini/gemini-cli), [opencode](https://opencode.ai/docs/rules/), [Zed](https://zed.dev/docs/ai/rules), [Amp](https://ampcode.com/manual), [Windsurf / Cascade](https://docs.devin.ai/desktop/cascade/agents-md), [Cline](https://docs.cline.bot/customization/cline-rules), [Aider](https://aider.chat/docs/usage/conventions.html), [Jules](https://jules.google/docs).
