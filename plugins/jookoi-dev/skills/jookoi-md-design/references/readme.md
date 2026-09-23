# README notes

What agents tend to get wrong in READMEs. The model already knows the usual sections; this file is about order, the first screen, and not trampling an existing README.

## Contents

- [Existing READMEs](#existing-readmes)
- [Principles](#principles)
- [The first screen](#the-first-screen)
- [By repo type](#by-repo-type)
- [Anti-patterns](#anti-patterns)

## Existing READMEs

Most READMEs already exist. Treat the current one as the author's design:

- Keep their section order, names, and voice. Insert new content where a reader would look for it.
- Missing a quick start or a one-liner is the most common real gap. Add it near the top without moving everything else.
- Fix scannability in place: split walls of text, table a comparison, fence and tag code, trim a badge wall.
- Update facts that the current change made wrong. A stale README misleads more than a short one.
- Don't add sections for completeness (Contributing, Roadmap, Acknowledgements) unless asked.

## Principles

- **Funnel from broad to specific.** What it is, a working example, then detail. A reader can leave at any point with an accurate picture.
- **As short as it can be without being any shorter.** Depth goes to `docs/` or sibling files, linked.
- **Usable without reading the code.** If someone has to open source files to learn how to call it, the README is incomplete.
- **Show before telling.** The first code block or visual should be on the first screen.
- **Caveats up front.** Saying what it doesn't do saves the reader more time than a feature list.
- **Facts over adjectives.** "Parses 1 GB/s" or "zero dependencies" beats "blazing fast" and "lightweight".

## The first screen

- A hero: logo or banner, one-line tagline, badge row, and a nav row for bigger projects. Components and presets are in [components.md](components.md). No "About" heading.
- Badges: 3–6 that carry information (CI, version, license, coverage), on one line. Decorative badges are noise.
- A quick start (install plus smallest working example) or a visual, whichever shows the project better.
- GitHub has a built-in outline button, so a manual table of contents only pays off in long READMEs or ones read outside GitHub.

## By repo type

The usual sections are known; the weighting differs.

- **Library:** quick start and API carry the weight. An options table beats prose.
- **CLI:** one block with the command and its output. Subcommands in a table.
- **App or service:** visual first, then run locally, then deploy. Environment variables in a table.
- **Internal or personal repo:** what, why, structure, how to use. A `text` tree of the layout with one-line comments is often the most useful block. No badges or marketing.
- **Skill or plugin collection:** a table of entries (`Name | What | Why`), then install commands per host.
- **Monorepo:** a short root README that routes to package READMEs through a table.
- **Awesome list or catalogue:** grouped headings, one line per entry as `[**Name**](link) - what it is`, alphabetical within a group.

## Anti-patterns

| Pattern | Fix |
|---|---|
| Title only | Add a hero, one-liner and one working example |
| Wall of plain text, no visual anchors | Hero, highlights, tables, a visual, callouts |
| "Obvious to me" | Versions, prerequisites, exact commands |
| The novel | Headings every screen, lists for lists, cut half |
| "See the docs" and nothing else | Quick start inline, depth linked |
| Badge wall, emoji on every heading | A few meaningful badges, plain headings |
| Screenshot of code or config | A code block |
| Install buried under history | Quick start near the top |
| Existing README rewritten to a template | Targeted additions in the author's structure |
