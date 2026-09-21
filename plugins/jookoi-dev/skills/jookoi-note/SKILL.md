---
name: jookoi-note
description: Use when explicitly invoked to capture a durable cross-project note in the JooKoi developer stack, the user's personal repository of AI-development conventions, skills, architecture, backlog, exploration pointers, and working guidance. Route it to the right stack file. Do not use for ordinary notes about the current project or transient process observations, which belong in the local paper trail or `jnote`.
---

# JooKoi notes

The destination is always `D:\repos\Serenity\JooKoi-developer-stack` (`file:///D:/repos/Serenity/JooKoi-developer-stack`), regardless of the current directory. This is the user's personal AI developer stack. Use this skill only when explicitly invoked. If the checkout is missing, report that and ask for its new location. Do not create a replacement checkout.

The stack is a curated, harness-agnostic personal base of operations. Its plain files hold reusable skills and prompts, architecture records, live work, backlog items, personal guidance, and short pointers to research or tooling worth revisiting. This skill captures durable cross-project knowledge for that stack. It is not the current project's documentation or a general-purpose event log.

Capture the user's meaning with the smallest useful edit. A quick note does not need a research pass or a plan unless the user asks for one.

Route by intent:

| Note | Destination |
|---|---|
| Tool, library, article, or topic to look at later, with no work committed | `EXPLORE.md` (or `_jookoi-EXPLORE.md` for a private/raw pointer) |
| Idea or intended work on this stack, not yet scoped or scheduled, including a skill to build | `_architecture/BACKLOG.md` |
| Work already picked up or selected as next | `_architecture/TODO.md` checklist |
| Personal preference or guideline | Existing matching file in `personal-guidelines/`; create a focused file there only if none fits |

These are destinations for different kinds of durable knowledge, not interchangeable note buckets. `_architecture/plans/` and `_architecture/plans/decisions/` are for a real planning session or a decided call, so use `jookoi-paper-trail` when the note has that shape. `_architecture/archive/` is written only by that skill's flush operation. `_architecture/process-improvement/logs.jsonl` is for transient process observations, such as confusion or a useful pattern from the current session, and is written by `jnote`, not here.

Read only the chosen destination and the relevant rules in the target repo's `AGENTS.md` before editing. Do not load the whole stack to add one note. For `BACKLOG.md` or `TODO.md`, also use the installed `jookoi-paper-trail` skill and its format rules. Its script owns backlog insertion and other bookkeeping. Check for an existing equivalent note, and make the smallest edit that preserves the user's meaning. Ask where it belongs only if two destinations remain plausible. Keep exploratory pointers short. Do not turn them into researched claims or implementation plans. A captured skill idea is a backlog note, not a new skill build.

Do not add a generic append script for this skill. The agent still has to decide which destination is semantically correct, whether the note duplicates or invalidates an existing entry, and whether it is shared or private. Blind appending would save little context while making malformed or misplaced notes more likely. Once the destination is known, use the destination's existing script when one exists, or read only that file's local structure for a surgical edit.

Write only inside the destination checkout, never to its archive, and do not commit. Report the destination and the note added. Never record credentials or secrets.
