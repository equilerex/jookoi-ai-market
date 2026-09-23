# Markdown and README research

Input for a future `SKILL.md` that makes agents write markdown that is easy to scan for humans and easy to parse for LLMs. Light practitioner research, not a literature review. Gathered 2026-09-23.

**Scope:** what makes a README good, general markdown layout and copywriting, lesser-known syntax and layout tricks, and writing for LLM readers. Tone of voice is out of scope here because `jookoi-write-casual-technical` already covers it. The new skill should defer to it for voice and own structure, layout and syntax.

## Contents

- [Core findings](#core-findings)
- [README structure](#readme-structure)
- [Copywriting for scanners](#copywriting-for-scanners)
- [Markdown layout rules](#markdown-layout-rules)
- [Lesser-known syntax and tricks](#lesser-known-syntax-and-tricks)
- [Writing for LLM readers](#writing-for-llm-readers)
- [Anti-patterns](#anti-patterns)
- [Open questions for the skill](#open-questions-for-the-skill)
- [Sources](#sources)

## Core findings

1. **People scan, they don't read.** NN/g found 79% of users scan a new page and 16% read word by word. Concise text alone improved usability 58%, scannable layout 47%, and cutting promotional language 27%. All three combined: 124%.
2. **Funnel from broad to specific.** The first screen answers "what is this and is it for me". Detail comes later or lives in another file.
3. **Show, don't describe.** One runnable example beats a paragraph about capabilities.
4. **Humans and LLMs want mostly the same thing.** Clear heading hierarchy, self-contained sections, explicit names instead of back-references, code in fenced blocks with a language tag. Optimizing for one mostly helps the other.
5. **Fancy HTML layout is GitHub-only.** `align`, `<picture>` and alerts degrade or show raw on npm, crates.io, docs.rs, mkdocs, Discord and most LLM tooling. Use it for decoration only, never for content.

## README structure

### Recommended order

Synthesized from Art of README, Make a README, freeCodeCamp and the 2026 practitioner guides. Cut what doesn't apply.

| # | Section | Purpose | Notes |
|---|---|---|---|
| 1 | Title | Name of the thing | One `#` H1, nothing else on the line |
| 2 | One-liner | What it is and who it's for | Concrete: "CLI that converts Markdown to PDF" beats "a powerful document tool" |
| 3 | Visual (optional) | Screenshot, GIF or diagram | Only if the output is visual. Always with alt text |
| 4 | Quick start | Install + smallest working example | Aim for five lines or fewer, copy-pasteable |
| 5 | Why / background | Problem it solves, when not to use it | Caveats up front saves everyone time |
| 6 | Usage | Two or three most common cases | Real input and real output |
| 7 | API / config / reference | Everything else | Link out if long |
| 8 | Contributing | How to run tests, open PRs | Or link `CONTRIBUTING.md` |
| 9 | License | One line plus link | Required for corporate adoption |

### Rules of thumb

- "As short as it can be without being any shorter" (Art of README). Push depth into `docs/` and link to it.
- Done means someone can use the project without reading its source.
- Nothing critical lives only in an image.
- Keep it current. An outdated README is worse than a short one, because it actively misleads.
- For internal or skill repos the order shifts: what, why, structure, how to install/use. The user's own `README.md` already follows this with a skills table.

## Copywriting for scanners

From NN/g, Google's developer style guide and README guides.

- **Inverted pyramid.** Conclusion first, reasoning after. The first sentence of every section should stand alone.
- **One idea per paragraph.** Readers skip anything not signaled by the opening words.
- **Cut to half.** NN/g's rule: half the word count of conventional writing, or less.
- **Headings say what's under them.** Plain, not clever. Task headings start with a bare verb ("Install the CLI"), concept headings are noun phrases ("Cache invalidation").
- **Sentence case headings**, no trailing punctuation, no links or code in headings where avoidable.
- **Front-load keywords** in headings, list items, table cells and link text. Scanners read the first two or three words.
- **Descriptive link text.** "See the [config reference](...)", never "click [here](...)".
- **Objective over promotional.** "Blazingly fast", "powerful", "seamless" make readers filter hype before finding facts.
- **Bold sparingly** for the one term per paragraph a scanner should catch. Bold everywhere equals bold nowhere.
- **Lead-in labels on list items** (`**Scope:** ...`) make long lists scannable.
- **Use "the following sections"** rather than "this section" when introducing a group, to avoid ambiguity.

## Markdown layout rules

Mostly from markdownlint and Google style. These are the rules that make raw source readable too, which matters because LLMs and many humans read the source, not the render.

### Headings

- One H1 per file, on the first line.
- Never skip levels (H2 to H4).
- No empty headings: every heading has text before the next heading.
- No duplicate sibling headings. They create ambiguous anchors.
- Don't number headings; order carries sequence.
- Avoid emoji in headings. They break or uglify auto-generated anchors (`#-install`).

### Whitespace and syntax

- Blank line before and after headings, lists, fenced code blocks, tables and HTML blocks. Many renderers break without it, especially inside `<details>` and `<div>`.
- ATX headings (`#`), never setext underlines.
- One list marker style per file (`-` is the common choice).
- Fenced code blocks always carry a language (` ```bash `, ` ```json `, ` ```text ` for plain output).
- No bare URLs; wrap them in `<...>` or give them link text.
- Every image has alt text.
- File ends with one newline; no trailing spaces (they are an invisible line break, use `\` or `<br>` if a break is intended).

### Choosing the right block

| Content | Use | Why |
|---|---|---|
| Sequential steps | Numbered list | Order is meaningful |
| Unordered facts, options | Bullet list | Scannable, easy to diff |
| Comparing items on 3+ attributes | Table | Eye scans columns |
| 2 attributes or long prose per cell | Bullets with bold labels | Tables with paragraphs in cells are unreadable in source |
| Commands, config, output | Fenced code block | Copyable, monospaced, tokenizes cleanly |
| File tree | ` ```text ` block with `├──` | Universally readable |
| Flow, architecture | Mermaid block | Diffable text, renders on GitHub/GitLab |
| Warnings, gotchas | Alert (`> [!WARNING]`) | Visual interrupt |
| Rarely needed detail | `<details>` | Keeps the main path short |

### Lists

- Max two levels of nesting. Deeper means it wants to be a heading or a table.
- Parallel grammar across items (all start with a verb, or all are noun phrases).
- No single-item lists.
- Don't end items with periods unless they're full sentences; be consistent within a list.

### Tables

- Keep cells short. If a cell needs a paragraph, it's the wrong block.
- Align with `:---` (left), `:---:` (center), `---:` (right). Right-align numbers.
- Escape pipes inside cells as `\|`. `<br>` works for a line break in a cell on GitHub.
- Put the identifying column first.

## Lesser-known syntax and tricks

Support marked **GH** (GitHub), **GL** (GitLab), **CM** (plain CommonMark, works everywhere).

### Content features

| Feature | Syntax | Support | Notes |
|---|---|---|---|
| Alerts | `> [!NOTE]` / `TIP` / `IMPORTANT` / `WARNING` / `CAUTION` on first line of a blockquote | GH, GL, Obsidian (as callouts) | Degrades to a plain blockquote elsewhere. Can't nest in lists. Use max one or two per section |
| Collapsible section | `<details><summary>Title</summary>` + blank line + content + `</details>` | GH, GL, most HTML renderers | Blank line after `</summary>` is required for markdown inside. `<details open>` to expand by default |
| Footnotes | `text[^1]` and `[^1]: note` | GH, GL | Good for sources without cluttering prose |
| Task list | `- [ ]` / `- [x]` | GH, GL | Interactive in issues/PRs |
| Keyboard keys | `<kbd>Ctrl</kbd>+<kbd>C</kbd>` | GH, GL | High polish per character |
| Sub/superscript | `<sub>`, `<sup>` | GH, GL | `<sub>` also works as small caption text under images |
| Underline | `<ins>text</ins>` | GH | Rarely worth it; reads like a link |
| Math | `$x^2$` inline, `$$...$$` block, or ` ```math ` | GH, GL | Use ` ```math ` when `$` clashes with prose (prices) |
| Diagrams | ` ```mermaid `, also `geojson`, `topojson`, `stl` on GH | GH, GL, Notion, Obsidian | Mermaid is the only one worth defaulting to |
| Diff coloring | ` ```diff ` with `+` / `-` lines | Most highlighters | The only portable "colored text" |
| Color swatch | `` `#0969DA` `` in backticks | GH (issues/PRs/discussions) | Renders a swatch |
| Hidden comment | `<!-- note -->` | CM | Good for linter directives and notes to future editors/agents |
| Reference links | `[text][ref]` + `[ref]: https://...` at file bottom | CM | Keeps prose readable in source when URLs are long |
| Heading anchors | `[Install](#install)` | GH, GL | Lowercase, spaces become `-`, punctuation dropped |
| Custom anchor | `<a id="top"></a>` | GH | For "back to top" links: `<a href="#readme-top">back to top</a>` |
| Relative links | `[guide](docs/guide.md)` | GH, GL | Works across branches and forks, unlike absolute URLs |
| Inline code with backticks | ``` `` `code` `` ``` | CM | Double backticks delimit code that contains backticks |
| Escaping | `\*`, `\|`, `\#` | CM | |

### Layout tricks (GitHub-specific, decoration only)

GitHub strips `style`, `class`, `<font>`, `<iframe>` and `<script>`. The legacy `align`, `width` and `height` attributes are what's left.

- **Centered hero block:**

  ```html
  <div align="center">

  <img src="docs/logo.svg" alt="Project logo" width="120">

  # Project name

  One-line description.

  </div>
  ```

  Blank lines inside the `<div>` let markdown render. `<div align>` is slightly more portable than `<p align>`.
- **Image size:** `<img src="..." alt="..." width="400">`. Markdown `![]()` has no sizing.
- **Float image beside text:** `<img align="right" width="120" src="..." alt="...">`. Text wraps. `align` briefly broke in 2024, so don't depend on it.
- **Side-by-side images:** several `<img width="32%">` in one `<p>`, or a markdown table with one image per cell.
- **Light/dark images:**

  ```html
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/logo-dark.svg">
    <img alt="Project logo" src="docs/logo-light.svg">
  </picture>
  ```

- **Video "embed":** linked thumbnail, `[![Demo](thumb.png)](https://youtu.be/...)`. GitHub blocks iframes. Uploaded `.mp4` in the web editor renders as a player.
- **Badges:** shields.io. Keep to 3–6 that carry information (build, version, license, coverage). A wall of badges is noise.
- **Manual indent:** `&nbsp;` repeated. Use sparingly.
- **Vertical spacing:** `<br>` between blocks. Prefer structure over spacing hacks.
- **Built-in outline:** GitHub shows an auto TOC button on every rendered `.md`. A manual TOC is only worth it for long files or for non-GitHub readers (including LLMs).

### Portability rule

Before using HTML or a GitHub extension, check where the file will be read. npm, PyPI, crates.io, docs.rs, VS Code preview, Discord, Slack and LLM context windows either ignore it or show raw tags. Content must survive being rendered as plain CommonMark; only decoration may depend on GitHub.

## Writing for LLM readers

From Anthropic's skill-authoring guide, Fern, llms.txt and general RAG practice.

- **Markdown over HTML.** Fern cites over 90% fewer tokens than the equivalent HTML page. Raw HTML layout in markdown is noise to a model.
- **Self-contained sections.** Retrieval may pull one section alone. Write "OAuth 2.0 token refresh", not "the method above".
- **Consistent terminology.** Pick one word per concept ("endpoint", never also "route" and "URL") and keep it.
- **Assume the reader is smart.** Every sentence should justify its tokens. Skip explaining what a PDF is.
- **Progressive disclosure.** Main file is an overview with links; details live in sibling files loaded only when needed.
- **Links one level deep.** Main file links to references; references don't chain to more references. Models may only partially read nested files.
- **TOC at the top of files over ~100 lines**, so a partial read still shows the full scope.
- **Concrete examples as input/output pairs.** Models pattern-match examples harder than prose rules.
- **One default, not a menu.** Offer a recommended path with escape hatches.
- **No time-relative phrasing.** "Before August 2025 use X" rots. Put the current way first and legacy in a `<details>`.
- **Explicit types, constraints and error cases** in reference docs; a model that has to guess writes code that fails.
- **Forward slashes in paths, descriptive filenames** (`form-validation.md`, not `doc2.md`).
- **llms.txt** (llmstxt.org): an H1, a blockquote summary, then H2 sections of annotated links. Useful mental model for any index file: name, one-line summary, curated links with a phrase each.
- **Frontmatter** (YAML between `---`) is a clean place for machine metadata (name, description, date) without cluttering the body.

## Anti-patterns

| Pattern | Problem | Fix |
|---|---|---|
| Empty README (title only) | Signals abandonment | At least one-liner, install, one example |
| "Obvious to me" | Assumes ecosystem knowledge | Write for someone new to the stack |
| The novel | Wall of text, no hierarchy | Headings every screen, bullets, cut 50% |
| "See the docs" | Loses most readers at the door | Quick start inline, depth linked |
| Stale content | Actively misleads | Date or version the provenance; delete what's wrong |
| Badge wall, emoji on every heading | Visual noise, broken anchors | 3–6 meaningful badges, no heading emoji |
| Bold/caps everywhere | Nothing stands out | One emphasis per paragraph max |
| Content only in images | Invisible to screen readers, LLMs, search | Text first, image as support, alt text always |
| Layout via HTML tables/`align` | Breaks outside GitHub | Keep content in plain markdown |
| Deeply nested lists | Hard to scan, hard to parse | Promote to headings or a table |
| "Click here" links | Useless when scanned or extracted | Describe the destination |
| Marketing adjectives | Readers filter hype, trust drops | State the fact or the number |

## Open questions for the skill

Decisions to settle when turning this into `SKILL.md`:

- **Split by file type?** README vs internal docs (`CONTEXT.md`, plans) vs `SKILL.md` have different openings. Likely one core rule set plus a short per-type template section, or reference files per type.
- **GitHub-flavored by default?** Proposed: yes for alerts, `<details>`, footnotes and Mermaid; decorative HTML only when the file is a public repo README.
- **Relationship to `jookoi-write-casual-technical`:** that skill owns voice; the new one owns structure and syntax. Cross-link, don't duplicate.
- **Include a lint step?** `markdownlint-cli2` would enforce most layout rules mechanically. Could ship a config in `assets/`.
- **Templates:** a README skeleton and a reference-doc skeleton as copyable blocks, following the "one default with escape hatches" rule.

## Sources

- [Art of README](https://github.com/hackergrrl/art-of-readme): cognitive funneling, section order, checklist
- [How users read on the web, NN/g](https://www.nngroup.com/articles/how-users-read-on-the-web/): scanning statistics and six writing rules
- [Google developer style guide: headings](https://developers.google.com/style/headings): heading rules
- [GitHub Docs: basic writing and formatting](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax): alerts, footnotes, anchors, HTML support
- [GitHub Docs: creating diagrams](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams): Mermaid, GeoJSON, TopoJSON, STL
- [GitHub Blog: images for dark and light mode](https://github.blog/developer-skills/github/how-to-make-your-images-in-markdown-on-github-adjust-for-dark-mode-and-light-mode/): `<picture>` syntax
- [David Wells: aligning images in GitHub markdown](https://gist.github.com/DavidWells/7d2e0e1bc78f4ac59a123ddf8b74932d): align, float, side-by-side
- [MarkdownTools: markdown hacks](https://www.markdowntools.io/syntax/hacks): kbd, details, centering, platform support
- [Issue: p align doesn't render on most engines](https://github.com/sachncs/find/issues/22): portability argument
- [5 markdown tricks, DEV](https://dev.to/zhihu_wu_dea1d82af01a04d7/5-markdown-tricks-every-developer-should-know-that-arent-in-the-cheat-sheet-23bh): anchors, double backticks, Mermaid
- [How to write a good README, 5 mistakes](https://www.kunalganglani.com/blog/write-good-readme-guide): structure and anti-patterns
- [freeCodeCamp: how to write a good README](https://www.freecodecamp.org/news/how-to-write-a-good-readme-file/): section checklist
- [Best-README-Template](https://github.com/othneildrew/Best-README-Template): centered header, back-to-top pattern
- [awesome-readme](https://github.com/matiassingers/awesome-readme): curated examples to browse
- [Anthropic: skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices): conciseness, progressive disclosure, TOCs, terminology
- [Fern: LLM-friendly documentation](https://buildwithfern.com/post/how-to-write-llm-friendly-documentation): self-contained sections, token cost of HTML
- [llms.txt spec](https://llmstxt.org/): index-file structure for LLMs
- [markdownlint rules](https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md): mechanical layout rules
