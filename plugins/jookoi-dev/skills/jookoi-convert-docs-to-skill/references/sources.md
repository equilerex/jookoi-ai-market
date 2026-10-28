# Sources: what to get, how, and what to keep

All raw material goes to a gitignored research folder (for example `support/`). The skill folder holds only original writing.

## What to ask the owner for

| Source | Ask for | Used for |
|---|---|---|
| Official manual | the file (PDF, CHM, HTML export) or the docs URL, plus its date or edition | facts: names, syntax, arguments, behaviour |
| Changelog | release notes URL or the manual section | version gates, spotting renamed or retired features in old answers |
| Community forum | URL. Whether fetching is allowed. Any saved captures or lists of thread titles | demand, user wording, pitfalls, staff answers |
| Tutorials, resource sections | URL or capture of listing pages with view counts | demand ranking, install formats for shared content |
| API typings or SDK definitions | repo URL | cross-checking scripting members |
| Real install | version, install and config paths, permission to run tests | ground truth for paths, file formats and apply routes |

If an item is missing, name it, say which phase waits on it, and carry on with the rest.

## Manual extraction

- Split by the document's own structure (PDF bookmarks, HTML headings) into one plain-text file per section, numbered in order: `0417-evaluator.txt`.
- Write an `INDEX.md` with number, section path, title, page and size, so agents grep the index and open only what they need.
- Plain text diffs cleanly, which makes updates a git diff.
- `scripts/extract_manual.py` does this for PDFs with bookmarks. CHM: decompile to HTML first (`hh.exe -decompile`) or ask for a PDF. Run research Python with `-I` when it reads downloaded files.
- Generate large lookup tables (every command and argument, every option) from the extract with a script. They ship as grep-only reference files.

## Forum harvesting

Get the owner's OK first. Fetching is outward-facing and the forum's terms apply.

**Prefer structured endpoints.** Discourse forums expose JSON:
- `/latest.json?page=N`, `/c/<slug>/<id>.json?page=N` for listings (titles, views, reply counts, solved flags)
- `/t/<id>.json` for a thread with posts, authors, staff and accepted-answer flags
- `/search.json?q=<terms>` for targeted lookups

Other forums: GitHub issues and discussions (`gh api`), Stack Overflow (public API), Reddit (`.json` suffix). For logged-in or script-heavy sites, use a browser automation skill or tool if one is available in the session (check the skill list for browser, Chrome or agent-browser skills). When nothing works, ask the owner for an HTTrack capture or a pasted title list.

**Be polite.** One request at a time, about 10 s apart, honour `Retry-After`, set a clear User-Agent, stop on repeated errors.

**What to collect.**
1. Listing pages first: titles, views, replies, solved state. This alone gives demand ranking and user wording.
2. Then bodies only for the top threads by views and the ones that define a cluster.
3. Normalise into one JSONL corpus: one thread per line with title, section, views, and posts (author, staff flag, accepted flag, text). Merge incrementally, since old captures aren't re-supplied.

**What to extract into the domain doc.**
- Question clusters with rough proportions (how-to, feature request, bug, conflict, licensing, install).
- The words people use for screen parts and features, with the official names.
- Recurring pitfalls and known limits, with the staff workaround.
- How staff answer: which mechanism they reach for first. This becomes the skill's least-power order.
- Companion tools people use to fill gaps.
- Installing shared content as a cluster of its own, if it shows up.

Forum text is never copied into the skill. Short excerpts with links at most.

## Bundled tools

`scripts/` in this skill has working versions of each step: `extract_manual.py`, `build_command_index.py`, `forum_fetch.py`, `forum_corpus.py`, `kb_tools.py`. Run them from the research repo and adapt the regexes in `build_command_index.py` to the target manual.
