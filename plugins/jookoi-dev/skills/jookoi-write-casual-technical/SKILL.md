---
name: jookoi-write-casual-technical
description: Use whenever creating or editing technical documentation as a .md file (README, docs, SKILL.md, architecture notes, plans) that is not itself a reply to a person or non-technical text. Trigger even if the user hasn't asked for a writing-style check. For chat replies or people-facing text, prefer jookoi-write-like-a-person when it's installed.
metadata:
  author: Joosep Kõivistik
  repository: https://github.com/equilerex/jookoi-ai-market
  last_updated: "2026-10-09T23:48:31Z"
---

# Developer docs writing

Write docs any developer can scan in 30 seconds and act on, including neurodivergent / ADHD readers. Short, structured, direct. Not essay prose, not AI filler.

> [!IMPORTANT]
> The reader is a scanner, not a reader. They skim headings, bullets, code and bold words. Anything buried in a long sentence is lost.

Load `jookoi-md-design` alongside this skill. That one owns layout and components. This one owns the words.

## Contents

- [Default shape](#default-shape)
- [Kill the yapping](#kill-the-yapping)
- [Make it visual](#make-it-visual)
- [Tone](#tone)
- [Before and after](#before-and-after)
- [Self-check](#self-check)

## Default shape

Structure first, prose last. Reach for prose only when a list or table can't carry the idea.

| Content | Write it as |
|---|---|
| What this is | 1 to 2 sentences under the H1 |
| Steps | Numbered list, one action per step |
| Facts, rules, options | Bullets, one idea each |
| Comparison | Table |
| Command, config, path | Code block or backticks |
| Must-not-miss gotcha | `> [!WARNING]` callout |
| Rationale most readers skip | `<details>` or a linked file |

- 🎯 Answer first. Point, current state or command on the first screen.
- ✂️ One idea per bullet. Two ideas, two bullets.
- 📏 Paragraphs max 3 lines. Longer means split or convert to a list.
- 🧱 Break every screen. Heading, table, code block or callout. Never two paragraphs in a row.

## Kill the yapping

The failure mode: human-sounding prose that takes four clauses to say one thing.

- **Sentences short.** Aim under 20 words. A sentence with a comma chain or "which means that" gets split.
- **Fragments are fine.** "Runs on save. No config needed." beats a full sentence explaining both.
- **No narration.** Don't walk the reader through your reasoning. State the result.
- **No setup sentences.** Cut "This section explains...", "In order to understand X, we first need...". The heading already says it.
- **No restating.** A point made once in a bullet does not come back as a closing paragraph.
- **Why, in one line.** Rationale gets one line ("Postgres, not SQLite: needs concurrent writers"). Deeper reasoning goes in `<details>` or a linked doc.
- **Cut, then cut again.** Delete any sentence the reader could lose without missing a fact they'd act on.

## Make it visual

Raw text is tiring and repetitive to look at. Visual anchors make scanning possible.

- **Emojis are welcome** as anchors at the start of bullets, callouts and table cells: ✅ ❌ ⚠️ 💡 🎯 🔧 📁. Looking a bit AI-made is fine when it helps the result.
  - Use them to mark meaning (good/bad, warning, tip), not to decorate every line.
  - Not in headings. They break anchor links.
- **Bold the one word** a scanner should catch per bullet or paragraph. Not whole sentences.
- **Tables over parallel paragraphs.** Three things described the same way are a table.
- **Code blocks for anything copyable.** Commands, config, paths, output.
- **Callouts** (`[!TIP]`, `[!WARNING]`) for the one or two things per section that must not be missed.
- **Whitespace.** Blank lines around every block. `---` between big parts of a long file.

Agent-facing files (SKILL.md, context, plans): same rules, but skip decorative HTML and images. Emojis as anchors are fine.

## Tone

- 🗣️ Plain and direct. Like a senior dev's notes, not a blog post.
- 🚫 No padding: no "It's worth noting", "Additionally", "In order to", no opening or closing pleasantries.
- 🚫 No AI vocabulary: delve, pivotal, robust, seamless, leverage, foster, showcase, empower, unlock.
- 🚫 No hype or metaphors. Explain the mechanism.
- 🔤 Simple verbs: "is, has, uses, runs", not "serves as, functions as, features".
- 🏷️ One name per concept. `OrderRepository` stays `OrderRepository`, never "the order store" later.
- 🧾 Concrete over abstract. Real values, real commands, real file names.
- ⚖️ Candor. State facts and problems plainly. Don't soften, don't hype, say when something is unknown.
- ✍️ No em dashes, no semicolons. Use a period, comma, colon or parentheses.

## Before and after

❌ Yappy:

> The cache layer is designed to sit between the API and the database, which means that whenever a request comes in, it will first check whether the data is already available in the cache before falling back to the database, and this significantly reduces latency for frequently accessed records.

✅ Scannable:

> **Cache** sits between API and DB.
>
> - Request checks cache first, falls back to DB on miss.
> - 💡 Cuts latency for hot records.

## Self-check

Read the file as a scanner: headings, first words of bullets, bold, code only.

- [ ] First screen says what this is or what to do.
- [ ] No paragraph over 3 lines. No two paragraphs in a row.
- [ ] No sentence that could be a bullet, no bullet that could be a table row.
- [ ] Every screen has a visual anchor: table, code, callout, list.
- [ ] Rationale is one line or tucked away.
- [ ] Nothing said twice. No closing recap.
