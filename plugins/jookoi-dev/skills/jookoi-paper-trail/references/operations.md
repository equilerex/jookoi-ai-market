# Operations — find, remove, staleness, section-surgical

The four capabilities the MVP deferred. Each one is a rule about *when not to write*, as much as how to write.

---

## Find — which context file applies here

Nearest-first, stopping at the repo root:

1. The working folder's own `CONTEXT.md`.
2. Each parent folder's `CONTEXT.md`, walking up.
3. `_architecture/` at the repo root.

Shared and private files at the same level are **both** read: `CONTEXT.md` then `_jookoi-CONTEXT.md`, private last so it wins on conflict. Same at the root: `_architecture/` then `_jookoi-architecture/`.

Never walk above the repo root. A folder with no `CONTEXT.md` is not a defect — most folders should not have one.

**Read when stuck, not always.** Entering unfamiliar territory, or about to change something whose shape is not obvious from the code, is the trigger. Routine edits in a folder already understood are not.

---

## Remove — deleting a context file

A folder's `CONTEXT.md` dies with the folder. That rule is safe only if the content really was folder-local, so before removing:

1. **Report inbound references.** `grep` for the folder path and for the `CONTEXT.md` path across the repo. Links from `_architecture/` or from sibling context files break silently otherwise.
2. **Offer the durable half for promotion.** A "Why it's built this way" or "Don't" entry that explains a repo-wide decision was mis-filed, not folder-local. Move it to `TODO.md`'s `## Context` header, or to a decision record if it was a call with alternatives. Delete only what genuinely dies with the code.
3. **Then delete.** With the folder, in the same change.

Never delete a `CONTEXT.md` while its folder stays. If the file is wrong, correct it; if it is empty, that is a signal the folder never needed one, and removing it is fine — but say so rather than doing it silently.

---

## Staleness — `jookoi-paper-trail stale`

Compares each context file's `updated:` line against the folder's last commit date:

```
git log -1 --format=%cd --date=short -- <folder>
```

`updated:` older than the folder's last commit means the code moved and the context may not have. **Likely stale, not stale** — a commit that only touched formatting invalidates nothing.

Reporting only, deliberately. No auto-fix and no batch rewrite: the design's rule is that when context contradicts code, the code wins and the context is corrected *at the point of noticing*. That correction is judgement about what changed and why, which a batch job does not have. `stale` produces the list; a session working in one of those folders fixes that one.

Zero context files is a clean result, not an error — it is the expected state of a repo that has not needed one yet.

---

## Section-surgical updates

Every file type in `references/file-formats.md` has a fixed section set. An update therefore targets exactly one heading:

1. Locate the heading.
2. Rewrite the text between it and the next heading of the same or higher level.
3. Leave every other byte unchanged.
4. Bump `updated:` if the file has one.

**Never regenerate a file to change a section.** Regeneration silently drops content the current session did not happen to be thinking about, and it is invisible in review because the whole file shows as changed. The templates in `assets/templates/` are for creating a file that does not exist — not for refreshing one that does.

`TODO.md`'s two headings carry different exceptions to this rule:

- **`## Context`** is *meant* to be replaced wholesale, in place, whenever it goes stale — not on any schedule. Rewrite it entirely rather than surgically editing a clause inside it.
- **`## Checklist`** is not regenerated at all — it is maintained item by item, the same normal edit used for any other list: add a line, flip `- [ ]` to `- [x]`, remove a line. It is a third kind of update, distinct from both "surgical single-section rewrite" and "wholesale replace."

---

## Refusing

Stop and report rather than write, when:

- The file does not match the shape in `file-formats.md` — report the line and what was expected. Do not reformat content another author wrote.
- The content contains anything resembling a secret — API key, token, credential, connection string. Never write it. Flag it.
- The note has no clear destination in the routing tree. Ask; do not pick the closest bucket. Wrong-bucket content is worse than absent content, because it is found later and trusted.
- Writing a `CONTEXT.md` would be bulk generation — one per folder because folders exist. Forbidden by the design.
