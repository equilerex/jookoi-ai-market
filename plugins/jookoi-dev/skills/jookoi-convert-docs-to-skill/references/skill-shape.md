# Target shape of the produced skill

## SKILL.md (always loaded, about 2K tokens)

1. **Local paths block** the user can edit (`auto` by default), plus env var overrides.
2. **First call:** a helper action that reports install path, version, running state and config path. If anything is missing, ask the user.
3. **Request pipeline:**
   1. Triage: how-to, build something, not possible natively, bug or crash, third-party conflict, OS integration, licensing or install.
   2. Translate the user's words to the product's name (load the UI map whenever the user describes the screen).
   3. Mechanism, least powerful first, in the order staff use.
   4. Change: exact setting path, command, config snippet or script.
   5. Explain, then ask. Act only on an explicit yes.
   6. Apply: back up, apply, show how to check and revert.
4. **Mental model table:** object, what it is, where it is configured.
5. **Routing table:** topic to reference file. Say "load one or two per question" and "grep the index, never read it whole".
6. **Fallback:** the official online docs for the long tail, the forum for symptoms that look like bugs. Facts from the web are checked against the installed version.
7. **Apply rules and never-do list** (if the skill applies changes).
8. **Answer shape:** yes, no or partly plus the official name, then manual steps, then the exact change, unverified items marked, version gate stated, offer to implement.

## references/ (loaded per question, 3K to 7K tokens each)

Organise by the customization surfaces and the embedded languages the forum showed, not by manual chapter. Typical set:

| File | Holds |
|---|---|
| `ui-map.md` | screen layout sketch, phrase-to-concept table (about 90 rows from forum wording), disambiguation of easily confused names |
| one file per surface | e.g. customize, file types, view formats, preferences map |
| one file per embedded language | e.g. codes, rename or regex, expression language, scripting API |
| `commands.md` (generated) | every command and argument. Grep only |
| `kb/` (distilled) | one entry per feature or settings page, 5 to 40 lines: `## slug \| title`, then `ui:` path, `user-words:` list, `what:`, `options:`, `cmd:`, `notes:`, `see:`. `INDEX.md` has one line per entry (slug, title, ui, user words) for grep. Covers the long tail without the online manual |
| `config-files.md` | where config lives, file formats and encodings, tested apply routes, backup, running commands from outside |
| `limits-and-triage.md` | triage rules, version changes, known limits, companion tools |

Each reference file follows the authoring spec in `assets/authoring-spec.md`: user words to concept, model, mechanism tables, recipes from real demand, pitfalls.

## scripts/

One helper in the platform's built-in language. Actions that proved necessary: `info`, `backup`, `backups`, `diff`, `restore` (whole and single file), `cmd` (run a command in the app and detect error dialogs), `dialogs` (list or dismiss), `stop` and `start` (graceful only), install and remove for plugins or scripts, and a change log with rolling backups.

Also worth having:
- `kb -Query` to search the knowledge base ranked by hits.
- A way to confirm UI labels on the installed version before quoting them (manual labels drift between builds).
- An `audit` that reads passive state (favorites, recent folders, saved view formats, command logs, installed companion apps) to suggest workflow improvements. Live usage telemetry only when the user opts in, stored locally, with an off switch.

## Budgets

| Item | Target |
|---|---|
| SKILL.md | 2K to 4K tokens |
| Typical question | about 15K tokens loaded |
| Reference file | 12K to 28K characters |

Measure a typical question's load and state it in the README. Compare it with the manual's full size.

## Outside the skill

The extract, scrapes, corpus, domain doc and research tools live in the repo but outside the skill folder. The skill never depends on them at run time.
