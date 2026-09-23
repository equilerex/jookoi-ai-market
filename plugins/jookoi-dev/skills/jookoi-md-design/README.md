# jookoi-md-design

An LLM skill for markdown that looks designed: a themed component library for layouts, plus the rules for order, headings, block choice, syntax and portability. The aim is files that look good, scan in seconds, and parse cleanly for agents.

## Why

Markdown is now the working format for agents as much as for people: skills, handoffs, plans, memory, docs. Agent-written markdown fails in predictable ways. It opens with an "Introduction" heading before anything useful, bolds every other phrase, nests bullets four deep, puts emoji in headings that break anchors, stuffs paragraphs into table cells, and rewrites an existing README into a generic template. None of that is a syntax error, so nothing catches it.

Models also can't design. Plain markdown comes out fine by default, but asked for something that looks good, they reach for the same few `<p align="center">` snippets and a random badge wall. This skill makes designed layouts the default for human-facing files: a theme, presets drawn from real READMEs, copyable components, and exact badge URLs.

Voice is a separate problem, handled by `jookoi-write-casual-technical`. The two are meant to load together.

## What's in it

| File | Loaded when | Covers |
|---|---|---|
| `SKILL.md` | Always | Editing existing files, first screen, headings, block choice, raw-source hygiene, portability, rules for agent-read files, checklist |
| `references/readme.md` | Writing or editing a README | Principles, first screen, weighting by repo type, anti-patterns |
| `references/syntax-tricks.md` | Functional syntax beyond the basics | Collapsibles, alerts, footnotes, anchors, reference links, math, Mermaid, images, what GitHub strips |
| `references/components.md` | Any human-facing file | Theme tokens, presets from real READMEs, copyable components |
| `references/badges.md` | Badges or social proof | shields.io anatomy, badge catalogue, endpoint badges, contributor grids, star history |

## Where the material came from

A light practitioner research pass on 2026-09-23: Art of README, NN/g's scanning research, Google's developer style guide, GitHub's formatting docs, markdownlint, Anthropic's skill-authoring guide, and README guides and cheat sheets. Notes and sources are in [`_architecture/plans/markdown-readme-research.md`](../../../../_architecture/plans/markdown-readme-research.md).

The presets and components come from reading the root READMEs of Tailwind CSS, uv, Bun, Excalidraw, Supabase, VS Code, the OpenAI Python SDK, Claude Code and Vite, plus [awesome-design-md](https://github.com/voltagent/awesome-design-md). Badge URLs were checked against shields.io, contrib.rocks and star-history.com docs.

## Refresh checklist

GitHub's renderer and the badge services change quietly. Re-check these when refreshing:

- Alert types and where they render
- Whether `align` on images and blocks still works
- The HTML sanitizer's allowed tags and attributes
- shields.io paths in `badges.md`, the star-history embed snippet, and contrib.rocks parameters
- The READMEs behind the presets, in case they've been redesigned
