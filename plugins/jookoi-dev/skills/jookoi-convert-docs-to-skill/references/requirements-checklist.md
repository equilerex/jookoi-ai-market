# Requirements to agree at intake

Each of these changed the design in an earlier build. Settle them before drafting and record each answer in the plan. Give a recommended default with each question so the owner can just say yes.

## Scope and audience

| Question | Default | Why it matters |
|---|---|---|
| Personal skill or published? | personal, repo may be public | licence of sources, what may be committed, how much credibility the README must carry |
| Skill name and location | owner's naming convention from `AGENTS.md`, folder at the repo root, name easy to find on GitHub | renames later touch every path in the plan and docs |
| Target version | the version installed on the owner's machine, written against the newest manual | version gates, which facts need testing |
| Answer only, or also apply changes? | answer plus apply on explicit yes | apply needs a safety spike, helper script and backups |
| Platform | from the install | helper language, path conventions, WSL or shell translation |

## Sources and research

| Question | Default |
|---|---|
| Which manual format and edition? | owner supplies the file. Prefer PDF or HTML over CHM for extraction |
| Changelog location | release notes page or manual section. Needed for version gates |
| Forum: one-time research input or recurring? | one-time, with rare manual imports. No recurring scrape |
| May the agent fetch from the forum? | ask. Owner-made captures (HTTrack, saved listings) are the fallback |
| Community content in the skill? | only after its steps are verified against the manual or a test |
| Existing skills, typings or SDK definitions to cross-check against | grep only, never loaded whole. Note their licence |

## Build rules

| Question | Default |
|---|---|
| Built from scratch, or adapt the manual's structure? | from scratch, organised by the request pipeline |
| Helper dependencies | none beyond what the platform ships (on Windows: PowerShell 5.1, robocopy, Win32 via Add-Type). Research tools may use Python |
| Update tooling? | none. Re-extract, diff the extract, search the skill for changed terms |
| Interaction rule inside the skill | explain, ask "want me to implement this?", act only on yes |
| Install paths | skill knows the defaults, detects them, asks when not found, has an editable "Local paths" block |
| Backups and change log | backup before every change, a change log, rolling retention (about 30) |
| Live testing on the owner's machine | ask first. Say what may appear on screen and that it will be cleaned up |
| Review | the owner runs an external review with a different model at the end |

## Communicate as you go

- Every call the owner makes lands in the plan the same turn, with its reason.
- Every test result lands next to the instruction it supports in the skill, tagged with the version.
- Deviations from the plan are recorded as deviations, not silently applied.
- When a resource is missing, ask for that exact item, say which phase waits on it, and continue independent work.
