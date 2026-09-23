# AGENTS.md — jookoi-ai-market

Repository-specific guidelines and conventions for the personal plugin marketplace.

## What this repo is

Personal Claude Code plugin marketplace. Extension layer on top of `JooKoi-developer-stack` holding domain-specific and heavier tooling that needs actual plugin machinery.

## Skill conventions

Every skill authored for this marketplace must adhere to the following rules:

### 1. Naming and prefix
- Personal authored skills must use the `jookoi-` prefix (for example: `jookoi-create-skill`).
- Skill folder names must match the frontmatter `name` exactly.
- The folder name cannot be `synced`.
- The `name` must be 1 to 64 characters, lowercase alphanumeric with single hyphens (`^[a-z0-9]+(-[a-z0-9]+)*$`).
- Never use consecutive hyphens (`--`), leading hyphens, or trailing hyphens.
- Never use reserved words `claude` or `anthropic` in the name.
- Never include angle brackets (`<` or `>`) in the name.

### 2. Frontmatter description
- Keep the `description` as minimal as possible: one sentence, maximum two.
- State trigger conditions directly and functionally.
- Never write conversational padding or try to make it sound human.
- Never include angle brackets (`<` or `>`) in the description.
- Maximum length is 1,024 characters.

### 3. Allowed frontmatter fields
Only specific fields are recognized by Claude Code:
- `name` (required)
- `description` (required)
- `license` (optional)
- `compatibility` (optional, max 500 characters)
- `metadata` (optional string-to-string dictionary)

Never add custom top-level keys outside this list.

### 4. Author metadata and credits
Credit, repository links, version, and timestamps belong inside the `metadata:` dictionary:
```yaml
metadata:
  last_updated: 2026-09-23
  author: Joosep Kõivistik
  repository: https://github.com/equilerex/jookoi-ai-market
```
Claude Code excludes `metadata:` from the initial tool discovery system prompt, ensuring non-functional credit details do not consume tokens.

### 5. Repository cross-references
When adding or updating a skill:
- Update [README.md](file:///D:/repos/Serenity/jookoi-ai-market/README.md) (Skills table, Structure tree, Gemini CLI install command).
- Update [_architecture/ARCHITECTURE.md](file:///D:/repos/Serenity/jookoi-ai-market/_architecture/ARCHITECTURE.md) (Layout list).
- Update [plugins/jookoi-dev/.claude-plugin/plugin.json](file:///D:/repos/Serenity/jookoi-ai-market/plugins/jookoi-dev/.claude-plugin/plugin.json) keywords, description, and version if needed.

## Verification

Always verify before finishing:
```bash
npm run update-skills
```
Auto-fixes missing SKILL.md metadata, runs Anthropic's native `claude plugin validate` on plugin and marketplace manifests, then re-audits README.md, ARCHITECTURE.md and plugin.json references. Exits 0 when nothing is left; otherwise prints the remaining problems and an agent prompt.
