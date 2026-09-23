# Components

A pick-and-mix component library for designed markdown. Use it for every human-facing file that renders: READMEs, docs, guides, changelogs. Match the intensity to the project with a preset, but always design.

Set a [theme](#theme) once, choose a [preset](#presets) or individual [components](#components), and fill in the theme tokens. For status, metric and credibility badges, see [badges.md](badges.md).

## Contents

- [Rules](#rules)
- [Theme](#theme)
- [Presets](#presets)
- [Components](#components)
  - [Logo or banner hero](#logo-or-banner-hero)
  - [Custom SVG banner](#custom-svg-banner)
  - [Tagline](#tagline)
  - [Badge row](#badge-row)
  - [Nav row](#nav-row)
  - [Call-to-action link](#call-to-action-link)
  - [Showcase image with caption](#showcase-image-with-caption)
  - [Highlights list](#highlights-list)
  - [Feature grid](#feature-grid)
  - [Two-column text and image](#two-column-text-and-image)
  - [Image gallery](#image-gallery)
  - [Tech-stack icons](#tech-stack-icons)
  - [Annotated command block](#annotated-command-block)
  - [Support channels list](#support-channels-list)
  - [Collapsible FAQ](#collapsible-faq)
  - [Styled Mermaid](#styled-mermaid)
  - [Color swatches](#color-swatches)
  - [Contributors and star history](#contributors-and-star-history)
  - [Divider](#divider)

## Rules

- **Content first.** The file must still make sense with every image and HTML tag stripped.
- **Commit your own assets** to `.github/assets/` or `docs/assets/`. Use absolute `raw.githubusercontent.com` URLs only when the README is also rendered off GitHub (npm, PyPI), where relative image paths break.
- **One theme across the file.** Same accent, same badge style, same icon set. Mixing badge styles or emoji sets is what makes a README look assembled rather than designed.
- **The hero fits in one screen:** logo or banner, tagline, badges, nav. Then real content: a code block or a showcase image.
- **Check both GitHub themes.** Dark text on a transparent PNG vanishes in dark mode. Use `<picture>` variants or give images their own background.
- **Check narrow widths.** HTML tables squash on mobile; keep grids to 2–3 columns.
- **Alt text on every image.** Empty `alt=""` only for pure decoration like dividers.
- **GitHub strips `style`.** Tables always show borders; `style="max-width:100%"` in copied snippets does nothing. See [what GitHub strips](syntax-tricks.md#what-github-strips).
- **Short is fine, bare isn't.** Design-led companies (Tailwind, OpenAI, Anthropic) keep READMEs short, but every element is designed: light/dark logo, one sharp tagline, curated badges, a fast path to the docs. Scale the number of components to the project, not the level of care.

## Theme

Decide these tokens before writing, then reuse them in every component:

| Token | Example | Used by |
|---|---|---|
| `ACCENT` | `6366F1` | Banner, badge `color`, Mermaid fills, swatches |
| `ACCENT_2` | `EC4899` | Banner gradient end, highlight nodes |
| `BADGE_STYLE` | `flat-square` | Every shields.io badge (`flat`, `flat-square`, `for-the-badge`, `plastic`, `social`) |
| `ALIGN` | `center` or `left` | Hero block |
| `ICONS` | `none`, `emoji`, or `skillicons` | Feature grid, highlights, tech stack |
| `SEPARATOR` | `·`, `•`, or `\|` | Nav row |
| `DIVIDER` | `---`, SVG, or none | Between major parts |

If the project has a brand color or logo, derive `ACCENT` from it. If a `DESIGN.md` or design tokens exist, use those.

## Presets

Starting points drawn from real READMEs. Pick one, then swap components.

| Preset | Seen in | Hero | Badges | Body |
|---|---|---|---|---|
| **Minimal** | Tailwind CSS, OpenAI SDK, Claude Code, Vite | Logo (light/dark) or plain H1, one-line tagline | 1–4, flat | Straight to install and one code example, then links to docs |
| **Product** | Bun, Excalidraw, Supabase | Centered logo, tagline, badge row, nav row | 3–6 | Showcase image or GIF, feature list with links to docs, support channels |
| **Tool with proof** | uv, Ruff | H1, badges, one-line claim | 3 | Benchmark chart (light/dark), highlights list where each item links to its section or docs |
| **Bold** | Personal projects, launches | Custom SVG gradient banner | `for-the-badge` with logos | Feature grid, two-column rows, tech-stack icons, styled Mermaid |
| **Hub** | VS Code, monorepos | Plain H1 with a few community badges | Issues, chat | "The repository" explainer, contribution paths, related projects table |

Observed across the industry examples:

- The one-liner is a noun phrase with one differentiator: "An extremely fast Python package and project manager, written in Rust" (uv); "A utility-first CSS framework for rapidly building custom user interfaces" (Tailwind).
- The first code block or visual appears within the first screen, often before any H2.
- Highlights lists link each claim to proof or docs (uv: "10-100x faster" links to benchmarks).
- Long references move out: OpenAI links to `api.md`; Bun routes to docs through grouped link lists.
- Alerts are used sparingly, for one real warning (Claude Code: npm install deprecated).

## Components

Every snippet uses the theme tokens in `UPPER_CASE`. Replace them, and `OWNER/REPO`, before shipping.

### Logo or banner hero

```html
<p align="center">
  <a href="https://PROJECT_SITE">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/logo-dark.svg">
      <img alt="PROJECT_NAME" src=".github/assets/logo-light.svg" height="72">
    </picture>
  </a>
</p>
```

For a left-aligned Minimal hero, drop the `<p align>` wrapper and keep a markdown `# PROJECT_NAME` below the logo, or skip the logo entirely.

### Custom SVG banner

A hand-written SVG in the repo: gradients, layout, subtle animation. GitHub renders SVG through `<img>`, which allows inline `<style>` and CSS animation but blocks scripts, external fonts and external images.

```html
<p align="center">
  <img src=".github/assets/banner.svg" alt="PROJECT_NAME: one-line description" width="100%">
</p>
```

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="260" viewBox="0 0 1200 260">
  <defs>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ACCENT"/>
      <stop offset="1" stop-color="#ACCENT_2"/>
    </linearGradient>
  </defs>
  <style>
    .title { font: 700 72px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #fff; }
    .tag   { font: 400 26px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #ffffffcc; }
    .glow  { animation: pulse 6s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: .55; } }
    @media (prefers-reduced-motion: reduce) { .glow { animation: none; } }
  </style>
  <rect width="1200" height="260" rx="20" fill="url(#accent)"/>
  <circle class="glow" cx="1050" cy="60" r="160" fill="#ffffff22"/>
  <text x="64" y="140" class="title">PROJECT_NAME</text>
  <text x="64" y="192" class="tag">One-line description of what it does</text>
</svg>
```

- A solid or gradient background makes one file work in both themes.
- Only system fonts render. For a specific typeface, convert text to paths in a design tool.
- Keep motion slow and include the `prefers-reduced-motion` rule. Keep the file under ~50 KB.
- An `@media (prefers-color-scheme: dark)` rule inside the SVG follows the OS setting, not GitHub's theme picker. Use `<picture>` with two files when it must follow GitHub.

### Tagline

Directly under the hero. Plain text in Minimal; bold or italic in Product.

```html
<p align="center"><b>One-line description: what it is, for whom, one differentiator.</b></p>
```

### Badge row

One row, one style, grouped left to right as status, version, metrics, community. URLs in [badges.md](badges.md).

```html
<p align="center">
  <a href="https://github.com/OWNER/REPO/actions"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/OWNER/REPO/ci.yml?branch=main&style=BADGE_STYLE"></a>
  <a href="https://www.npmjs.com/package/PACKAGE"><img alt="npm version" src="https://img.shields.io/npm/v/PACKAGE?style=BADGE_STYLE&color=ACCENT"></a>
  <a href="https://github.com/OWNER/REPO/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/OWNER/REPO?style=BADGE_STYLE"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/github/license/OWNER/REPO?style=BADGE_STYLE"></a>
</p>
```

For a left-aligned row, markdown badges work too: `[![CI](BADGE_URL)](LINK_URL)` on one line, separated by spaces.

### Nav row

Top-level destinations under the badges. Doubles as a short table of contents.

```html
<p align="center">
  <a href="https://DOCS_URL">Docs</a> SEPARATOR
  <a href="#quick-start">Quick start</a> SEPARATOR
  <a href="examples/">Examples</a> SEPARATOR
  <a href="https://DISCORD_URL">Discord</a>
</p>
```

For wider spacing, Bun puts `&nbsp;&nbsp;•&nbsp;&nbsp;` between links.

### Call-to-action link

One prominent link to the docs, as Bun does:

```markdown
### [Read the docs →](https://DOCS_URL)
```

### Showcase image with caption

```html
<p align="center">
  <img src=".github/assets/showcase.png" alt="What the screenshot shows" width="900">
</p>
<p align="center"><sub>Caption that says what the reader is looking at.</sub></p>
```

A benchmark chart makes a strong showcase for performance tools (uv, Ruff). Ship light and dark variants with `<picture>`.

### Highlights list

Short claims, each linked to proof or docs. Portable, and often better than a grid.

```markdown
## Highlights

- [10-100x faster](BENCHMARKS.md) than `ALTERNATIVE`.
- Replaces `tool-a`, `tool-b` and `tool-c` with [one CLI](#usage).
- [Zero dependencies](package.json), ships as ESM.
```

With `ICONS=emoji`, start each item with one emoji from a consistent set (Excalidraw style). Supabase uses `- [x]` task-list checkmarks as a done-features list.

### Feature grid

Two or three columns of short features. Blank lines inside `td` let markdown render.

```html
<table>
  <tr>
    <td width="33%" valign="top">

**⚡ Fast startup**<br>
Cold start under 50 ms.

</td>
    <td width="33%" valign="top">

**🧩 Plugin API**<br>
Hooks for every lifecycle stage.

</td>
    <td width="33%" valign="top">

**📦 Zero dependencies**<br>
One file, ships as ESM.

</td>
  </tr>
</table>
```

Each cell gets a bold title and one short line. Emoji work as icons here; keep them out of headings.

### Two-column text and image

```html
<table>
  <tr>
    <td width="50%" valign="top">

### Live preview

Edits show up instantly. No reload, no lost state.

</td>
    <td width="50%">
      <img src=".github/assets/preview.gif" alt="Editing a component with the preview updating live">
    </td>
  </tr>
</table>
```

Alternate image left and right between rows for a landing-page rhythm.

### Image gallery

```html
<table>
  <tr>
    <td align="center"><img src=".github/assets/light.png" alt="Dashboard in light mode" width="100%"><br><sub>Light mode</sub></td>
    <td align="center"><img src=".github/assets/dark.png" alt="Dashboard in dark mode" width="100%"><br><sub>Dark mode</sub></td>
  </tr>
</table>
```

Without captions, skip the table: several `<img width="48%">` in one `<p>` sit side by side without borders. Wrapping a screenshot in `<kbd>` gives it a thin border, as Supabase does.

### Tech-stack icons

With `ICONS=skillicons`, [skillicons.dev](https://skillicons.dev) renders a row of uniform icons from one URL:

```html
<p align="center">
  <img alt="TypeScript, Vue, Vite, Node.js" src="https://skillicons.dev/icons?i=ts,vue,vite,nodejs&perline=8">
</p>
```

The badge alternative, one per technology, colored with the brand color:

```markdown
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=BADGE_STYLE&logo=typescript&logoColor=white)
```

### Annotated command block

Commands with aligned trailing comments, as Bun does. Explains a CLI in one glance.

```bash
tool init                  # create a config in the current folder
tool run build             # run the build script
tool add PACKAGE           # install a dependency
```

### Support channels list

Each channel with what it's best for (Supabase):

```markdown
- [Discussions](https://github.com/OWNER/REPO/discussions). Best for: questions and ideas.
- [Issues](https://github.com/OWNER/REPO/issues). Best for: bugs.
- [Discord](https://DISCORD_URL). Best for: chatting and sharing what you built.
```

### Collapsible FAQ

```html
<details>
<summary><b>Does it work with Node 18?</b></summary>

Yes, from version 2.1. Earlier versions need Node 20.

</details>
```

A stack of these reads like an accordion. Phrase each summary as the actual question.

### Styled Mermaid

````markdown
```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#ACCENT', 'primaryTextColor': '#ffffff', 'lineColor': '#8b8fa3'}}}%%
flowchart LR
  A[Request] --> B{Cached?}
  B -- yes --> C[Response]
  B -- no --> D[Origin] --> C
  classDef hot fill:#ACCENT_2,color:#fff,stroke:none
  class D hot
```
````

Mid-tone saturated fills with white text read on both themes. Other types that look good in a README: `timeline`, `quadrantChart`, `sequenceDiagram`, `gitGraph`, `pie`.

### Color swatches

For design-system docs or a DESIGN.md-style file:

```markdown
| Role | Token | Swatch |
|---|---|---|
| Accent | `#6366F1` | ![#6366F1](https://img.shields.io/badge/6366F1-6366F1?style=flat-square) |
| Surface | `#0D1117` | ![#0D1117](https://img.shields.io/badge/0D1117-0D1117?style=flat-square) |
```

In GitHub issues, PRs and discussions, a hex code in backticks renders its own swatch.

### Contributors and star history

Social proof blocks for the bottom of a README. Snippets and caveats in [badges.md](badges.md#contributor-and-activity-images).

### Divider

- `---` is the portable divider. Use it between major parts, not between every section.
- A thin gradient SVG matching the banner: `<img src=".github/assets/divider.svg" width="100%" alt="">`.
- `<br>` adds vertical space around the hero. Don't use it to fix spacing in the body.
