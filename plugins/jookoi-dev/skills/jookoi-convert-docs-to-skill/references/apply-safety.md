# Applying changes to a live application

Only for skills that change the app's config. Do this spike before designing, because it decides which routes the skill may use.

## Spike: questions to answer on the real install

1. Where does config live, and in which formats and encodings (BOM, line endings, indentation)?
2. Does the app hold config in memory and write it on exit? Then an external edit while it runs can be lost.
3. Which changes load live: new files dropped in, plugins or scripts, presets? Which are cached until closed and reopened?
4. Is there a command bridge from outside (a CLI that sends commands to the running app)? What does it mangle (backslashes, nested quotes)? Does it report errors?
5. What is the graceful exit command? Killing the process can corrupt config.
6. Does the documented backup command work from outside? Test it, don't trust it.
7. Which files does the app rewrite on every exit (window state, usage counters)? They show up in every diff.

Record each answer with `[tested <version>]` in the skill's config reference.

## Routes, safest first

| Route | When |
|---|---|
| Built-in command through the bridge | state changes the app supports live |
| Drop a new file into a watched folder | new toolbars, presets, scripts, if tested live |
| Hand the user a snippet to paste in the app's own editor | single items in existing UI config |
| Guide the user through the dialog | preferences. The app's supported route |
| Offline edit: backup, graceful stop, edit, start, check | existing config files. Only with the user's OK |

## Helper rules

- Backup before every change. A whole-folder copy is simple and small (the first build's config was about 570 KB). Keep a change log entry per applied change: time, what and why, route, backup used, files changed, how to revert. Prune to the newest 30 or so.
- `diff` against a backup shows what a dialog change touched: back up, let the user change it, diff.
- Full restore refuses while the app runs.
- After every bridged command, check for new error or prompt dialogs owned by the app's process. Report their text and stop. Provide a dismiss action that picks the safe button (Abort, Cancel).
- Keep commands with fragile quoting in presets, buttons or scripts inside the app, and trigger them by name through the bridge.
- Preserve the file's encoding, line endings and indentation on edits. Match edit anchors with the file's own newline.

## Testing on the owner's machine

- Ask first. Say what may appear on screen.
- Name test artifacts with a clear prefix (`zz`) and remove them all at the end. List them before reporting done.
- Take a full backup before a test round and restore it afterwards.
- Check for leftover dialogs before and after a round.
- A screenshot of the app window is a cheap on-screen check for UI changes.
- Two failures on the same test: stop and reframe.
