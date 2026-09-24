---
name: jookoi-md-design
description: Design guidelines for good-looking, easy to read and scan, ADHD-friendly markdown (.md) files.
metadata:
  last_updated: "2026-09-23T00:00:00Z"
  author: Joosep Kõivistik
  repository: https://github.com/equilerex/jookoi-ai-market
---

# Markdown design

Markdown is the working medium for both people and agents: skills, handoffs, plans, memory, context files, docs, READMEs. Most of these get read in fragments. A human scans headings and first sentences (NN/g measured 79% of users scanning and 16% reading word by word). An agent loads the file into context, often truncated, or retrieves a single section. Design every file so the first screen says what it is, the headings alone give an accurate outline, and every section makes sense read alone.

Write for the least patient reader. People with ADHD and other neurodivergent readers are often the first to give up on text that circles before making its point, buries the answer in a paragraph, or offers no visual anchors. A file that works for them gets to the point in the first line, chunks information into short, clearly labeled pieces, and makes skipping safe. It works better for everyone else too, agents included.

This is a design skill, not a copywriting skill. It owns the page: content blocks, spacing, layout, visual components, hierarchy, and the path the eye takes through the file. It does not prescribe content or templates; the task and the project decide those. Load `jookoi-write-casual-technical` alongside it for the words themselves: direct sentences, no padding, no filler. This skill makes a file look good and easy to move through; that one makes it worth reading.

## Workflow

1. **If the file exists, read it first and work with it.** See [Editing existing files](#editing-existing-files).
2. **Identify the reader and where it renders.** Human-facing files that render (READMEs, docs, guides) get designed layouts. Agent-facing files get design through structure only. See [Design by default](#design-by-default).
3. **Set a theme and pick components** from [references/components.md](references/components.md), at the intensity that fits the project.
4. **Write top-down.** The point or current state first, detail after. Put rarely needed material in `<details>` or a linked file.
5. **Run the [checklist](#checklist)** before delivering.

Load references only when the task needs them:

| Situation | Read |
|---|---|
| Any human-facing file: theme, presets, layout components | [references/components.md](references/components.md) |
| Writing or editing a README | [references/readme.md](references/readme.md) |
| Collapsibles, alerts, footnotes, anchors, math, Mermaid, escaping | [references/syntax-tricks.md](references/syntax-tricks.md) |
| Status, metric or credibility badges, contributor grids, star history | [references/badges.md](references/badges.md) |

## Design by default

Any model can produce plain markdown. This skill exists to produce files that look designed: deliberate layout, a consistent visual style, and components that make the page pleasant to land on and easy to move through.

For human-facing files that render (READMEs, docs, guides, changelogs, repo landing pages):

- **Set a theme first** (accent color, badge style, icon set, alignment) and use it everywhere. Consistency is what makes a page look designed rather than assembled.
- **Use layout, not just text.** A hero with logo or banner, tagline, badge row and nav. Highlights or a feature grid. Tables for anything comparable. Two-column rows pairing a feature with a visual. Showcase images with captions. Diagrams for flow. Callouts for the one thing that must not be missed. Collapsibles for depth.
- **Give the page rhythm.** Alternate prose, code, tables and visuals so no screen is one texture.
- **Match intensity to the project** with a preset from [components.md](references/components.md#presets): Minimal for libraries and SDKs, Product for apps and tools with users, Bold for launches and personal projects, Hub for monorepos. Minimal still means designed: a light/dark logo, a sharp tagline, a curated badge row, well-built tables.
- **Design serves reading.** Every visual element carries or organizes content, and the text still makes sense with HTML stripped (see [Portability](#portability)).

If the user asks for plain markdown, drop the decoration and keep the structure.

For agent-facing files (SKILL.md, instructions, memory, handoffs, context files), design through structure only: headings, tables, task lists, alerts, code blocks. Decorative HTML and images cost tokens and are invisible to a model.

## Layout and visual flow

Think of the page as a stack of content blocks that the eye moves down, not as text with formatting on top. Lay it out before writing it.

- **Plan the blocks first.** Sketch the page as a sequence: hero, highlights, code, table, visual, callout, details. Then decide what text each block needs, not the other way round.
- **One focal point per screen.** Each screen height should have something the eye lands on first: a code block, table, image, diagram, grid or callout. A screen of only paragraphs has no entry point.
- **Alternate textures.** Never stack two long paragraphs or two same-looking blocks in a row. Prose, then code, then a table, then a visual. The change in texture is what pulls the reader onward.
- **Lead in, then show.** Under a heading, one or two sentences frame the block below. Then the block carries the detail.
- **Keep paragraphs short.** Three to four lines on screen at most. Longer means split it, or turn it into a list or table.
- **Use whitespace deliberately.** Blank lines around every block, `---` between major parts of a long page, `<br>` around the hero on GitHub. Space separates ideas the way paragraphs do.
- **Group related things into one block.** Five related options go in one table or grid, not five paragraphs. Grouping shows the structure without the reader having to work it out.
- **Build a scan line down the left edge.** Headings, bold lead words, list markers and icons line up on the left, so a reader can run down the edge and pick their spot.
- **Show hierarchy through size and weight.** H2 for chapters, H3 for items within them, bold for the key term, `<sub>` for captions and fine print. Don't flatten everything to the same level.
- **Vary density down the page.** An airy first screen (hero, highlights, one example) and denser reference sections lower down, where readers arrive already looking for something specific.

## Editing existing files

Complement, don't replace. The existing structure reflects the author's project and habits.

- Keep the file's section order, heading names, list marker, table style and tone unless they break a rule here.
- Add what's missing in the place a reader would look for it. Don't reshuffle sections to match a generic ideal.
- Fix layout problems locally: split a wall of text, turn a comparison paragraph into a table, add a language to a code fence, shorten a vague heading.
- Raising the visual quality in place is in scope: add a hero, badge row, callouts, tables or a feature grid around the existing content. Reordering or rewriting the content itself isn't, unless asked.
- Restructure the whole file only when asked, or when it's unscannable and you say so first.
- Keep the diff reviewable. A small, targeted change is easier to accept than a rewrite.

## The first screen

- One H1, then one or two sentences on what the file is and who it's for. No "Introduction" or "Overview" heading.
- For state-carrying files (handoffs, plans, status), the first screen holds the current state and the next action, not history.
- Order sections by how soon the reader needs them, not by how the author thought of them.
- Files over ~100 lines get a short `## Contents` list of anchor links after the intro, so a partial read still shows the whole scope.
- Past ~300 lines, split into sibling files linked from the main one. Keep links one level deep: the main file links to references, references don't chain further.

## Headings

- One H1, on the first line. Never skip levels.
- Headings say what's under them. Task sections start with a verb ("Install the CLI"); concept sections are noun phrases ("Cache invalidation"). No clever titles.
- Sentence case, no trailing punctuation, no numbering, no emoji (emoji break anchors), no links in headings.
- Every heading has content before the next heading. No duplicate sibling headings.
- A heading roughly every screen of text. A longer stretch wants a subheading or a cut.

## Paragraphs and emphasis

- One idea per paragraph, stated in the first sentence. Scanners read the opening words and move on.
- Front-load keywords in headings, list items, table cells and link text.
- Bold at most one term per paragraph, the one a scanner should catch. Bold labels at the start of list items (`**Scope:** ...`) help when a list is long and the labels differ; don't stamp them on every list.
- Link text describes the destination: "see the [config reference](docs/config.md)", never "click [here](docs/config.md)".
- Name things explicitly. "The `retry` option" beats "the option mentioned above", because a retrieved section has no "above".
- One term per concept for the whole file. Don't alternate "endpoint", "route" and "URL" for variety.

## Choosing the block

| Content | Block |
|---|---|
| Steps in order | Numbered list |
| Unordered facts, options, rules | Bullet list |
| Items compared on 3+ attributes | Table |
| Items with 1–2 attributes or long text each | Bullets with bold labels |
| Commands, config, code, output | Fenced code block with a language |
| Directory layout | `text` code block with `├──` / `└──` and `#` comments |
| Flow, sequence, architecture | `mermaid` code block |
| Open work, acceptance criteria | Task list, `- [ ]` / `- [x]` |
| Gotcha the reader must not miss | Alert, `> [!WARNING]` |
| Detail most readers skip | `<details>` with a descriptive `<summary>` |
| Short answer, two or three sentences | Plain paragraph, no structure |

Don't force structure onto short content. A three-sentence explanation stays a paragraph.

- **Lists:** max two nesting levels; deeper wants headings or a table. Parallel grammar across items. No single-item lists.
- **Tables:** identifying column first, short cells; a cell that needs a paragraph means bullets instead. `---:` right-aligns numbers. Escape `|` in cells as `\|`. Six or more columns are unreadable in raw source; split or transpose.
- **Code blocks:** always tag the language (`bash`, `json`, `ts`, `diff`, `text` for plain output). Commands copy-pasteable, no `$ ` prefix unless output is in the same block. Real input and real output beat a paragraph describing capability. Obvious, consistent placeholders: `YOUR_API_KEY`, `path/to/file`.

## Raw-source hygiene

Agents and many humans read the source, not the render. Keep it clean:

- Blank line before and after every heading, list, code fence, table and HTML block. Markdown inside `<details>` or `<div>` only renders with blank lines around it.
- ATX headings (`#`), never `===` underlines.
- No bare URLs: `[text](url)` or `<https://...>`. For many long URLs, reference links (`[text][id]` plus `[id]: https://...` at the bottom).
- Every image has alt text saying what it shows. Nothing critical lives only in an image.
- No trailing whitespace (it's an invisible line break). One newline at end of file.
- Relative links for files in the same repo, so they work on forks, branches and locally.
- `<!-- comments -->` for notes to future editors or agents that shouldn't render.

## Portability

Content must survive plain CommonMark. Decoration may depend on GitHub.

| Syntax | Safe on |
|---|---|
| Headings, lists, code fences, links, images, blockquotes | Everywhere |
| Tables, task lists, strikethrough, footnotes | GitHub, GitLab, most editors and doc sites |
| Alerts `> [!NOTE]`, Mermaid, math | GitHub, GitLab, Obsidian; plain blockquote or raw code elsewhere |
| `<details>`, `<kbd>`, `<sub>`, `<sup>` | GitHub, GitLab, most HTML-rendering sites |
| `align`, `width`, `<picture>` | GitHub only, and fragile |

GitHub strips `style`, `class`, `<font>`, `<iframe>` and `<script>`. npm, PyPI, docs sites, chat apps and LLM context windows ignore HTML or show it raw. So:

- Build HTML layouts freely for files that live on GitHub or GitLab, but keep the content readable if the HTML is stripped. If the file's main home is npm, PyPI or a docs site, stick to the markdown-only components.
- In files meant for agents, skip decorative HTML entirely. It costs tokens and adds nothing.
- Alerts: one or two per section at most. When everything is a warning, nothing is.

## Files agents read

SKILL.md, agent instructions, handoffs, plans, memory, context and log files are read by a model that already knows the domain basics and has limited attention. Rules on top of everything above:

- **Every line earns its tokens.** Cut explanations of things any capable model knows. Keep what's specific to this project, decision or person.
- **Current state before history.** Status, next action and open questions go first; how you got there goes last or in a linked file.
- **Decisions carry their reason.** "Use Postgres, not SQLite: needs concurrent writers" survives; "Use Postgres" gets relitigated.
- **Absolute, not relative.** Dates as `2026-09-23`, never "yesterday" or "recently". Paths, file names, commands and identifiers written out exactly, in backticks, so the next reader can act on them without searching.
- **Explicit status markers.** `- [ ]` / `- [x]`, or a word like `blocked`, `decided`, `open`. A reader shouldn't infer status from tone.
- **One fact per line** in memory and log files, grouped under headings by topic. Update the line when a fact changes; don't append a contradiction.
- **Don't duplicate the source of truth.** Link to the code, commit or doc instead of copying what will drift.
- **One default with escape hatches**, not a menu of equal options.
- **Concrete examples over abstract rules.** Models follow a short input/output example harder than a paragraph of prose.
- **Structured metadata in YAML frontmatter**, not prose. Index files follow the `llms.txt` shape: H1 name, one-line summary, sections of links with a phrase each on what's behind the link.

## Checklist

Read the file as a scanner would: headings, first sentences, bold terms and code blocks only.

- [ ] The first screen says what this is, or what the current state is.
- [ ] Headings alone give an accurate outline; none is vague or clever.
- [ ] Each section makes sense read alone; no "as mentioned above".
- [ ] Block types match content: steps numbered, comparisons tabled, code fenced with a language.
- [ ] Human-facing file: a consistent theme, a designed first screen, and visual variety down the page.
- [ ] Nothing important depends on HTML, an image, or a GitHub-only feature.
- [ ] No walls: a heading or visual break at least every screen.
- [ ] Emphasis is rare enough to mean something.
- [ ] Every link and relative path resolves.
- [ ] Editing an existing file: its structure and conventions are intact apart from deliberate fixes.
- [ ] Anything cuttable without loss has been cut.
