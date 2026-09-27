# Viewer

A read-only local web page over `items.yaml` and `archive/items-*.yaml`, for every repo that uses the store. It never writes. `scripts/viewer/server.js` serves it, needs only Node (the vendored `js-yaml` parses), and binds to `127.0.0.1`.

## One server, one link

There is one server per machine on a fixed port, `http://127.0.0.1:4173`, so the link is the same in every session. Override the port with `JOOKOI_VIEWER_PORT` or `--port`.

`rehydrate.sh` runs `server.js ensure` at session start. `ensure` pings the port for this app, and if nothing answers it starts the server detached, then prints the URL. Several sessions can open at once: a running server is never started twice, and if two sessions race, the second process fails on the busy port and exits. The hook tells the agent to give the user the link once. `JOOKOI_VIEWER=0` turns the auto-start off.

## Repos register themselves

Any script call in a repo that has an `items.yaml` adds the repo root to `~/.jookoi-paper-trail/repos.json` (`%USERPROFILE%\.jookoi-paper-trail\repos.json` on Windows), a JSON array of absolute paths. Repos under the OS temp folder are skipped. The list survives across sessions and can be edited by hand.

```
node ~/.agents/skills/jookoi-paper-trail/scripts/viewer/server.js ensure        # start if needed, print the URL
node ~/.agents/skills/jookoi-paper-trail/scripts/viewer/server.js ensure --open # and open the browser
node ~/.agents/skills/jookoi-paper-trail/scripts/viewer/server.js add [path]    # register by hand (default: current repo)
node ~/.agents/skills/jookoi-paper-trail/scripts/viewer/server.js remove <path>
node ~/.agents/skills/jookoi-paper-trail/scripts/viewer/server.js list
node ~/.agents/skills/jookoi-paper-trail/scripts/viewer/server.js               # foreground, Ctrl+C to stop
```

The server only reads the architecture folders of registered repos and rejects requests whose `Host` header is not `127.0.0.1` or `localhost` on its port.

## In the page

- The sidebar picks the repo. Each repo shows its `now` count. A repo whose folder is gone is greyed out.
- A layer switch appears for repos that have both `_architecture/` and `_jookoi-architecture/`.
- Chips: `all`, `now`, `parked`, `done`, `dropped`, `archived`, with counts. Search matches ID, title and body within the active chip; `status:done` and `is:archived` tokens replace the chip. Sort: newest (default), oldest, priority. Keys: `/` search, `j`/`k` move, `Enter` toggle, `Esc` close. `#repo/id` deep-links to an item.
- `+ Add item` (or `n`) adds an item to the focused repo and layer: Immediate to-do (status `now`) or Backlog (status `parked`). The server shells out to `jookoi-paper-trail add`, so validation and ID generation are the CLI's. `POST /api/repo/:i/items` needs a JSON content type and a same-origin `Origin`.
- Bodies render as GFM through the vendored `jookoi-universal-mdx-render` build, HTML off.
- Click an item for its body and timestamps. `Copy stack:k4f9` copies the repo-prefixed ID. `Copy as markdown` copies one item, or the visible list from the top bar, for pasting into an LLM.
- Live: with the Live box checked the page re-reads every 4 seconds, but only while the tab is visible and the window has focus. The timer stops on blur or when the tab is hidden, and one refresh runs when focus returns. Changes made through the script appear without a reload. `Refresh` re-reads on demand, and the page shows when it last did.
