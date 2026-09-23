# Badges and metrics

Exact URLs for status, metric and credibility badges, plus contributor and activity images. Use with the [badge row](components.md#badge-row) component and the theme's `BADGE_STYLE` and `ACCENT`.

## Contents

- [Choosing badges](#choosing-badges)
- [URL anatomy](#url-anatomy)
- [Catalogue](#catalogue)
- [Custom and dynamic badges](#custom-and-dynamic-badges)
- [Contributor and activity images](#contributor-and-activity-images)

## Choosing badges

- **Order left to right:** status (CI, coverage), version, metrics (downloads, stars), community (Discord), license.
- **3–6 badges.** More than one row reads as a wall.
- **Link every badge** to what it measures: CI to the actions page, version to the registry, stars to `/stargazers`.
- **Alt text on every badge**, e.g. `alt="npm downloads per month"`.
- **Vanity metrics backfire on small projects.** A badge showing 3 stars or 12 downloads hurts credibility. Show metrics once they're flattering, and status and version from day one.
- **One style for all badges.** `flat-square` is quiet, `for-the-badge` is loud, `social` only fits stars and follows.
- **Only real signals.** Don't fake numbers with static badges; a reader who clicks through and finds different numbers stops trusting the rest of the page.

## URL anatomy

Every [shields.io](https://shields.io) badge takes the same query parameters:

```text
https://img.shields.io/PATH?style=flat-square&color=6366F1&labelColor=1F2328&label=CUSTOM%20LABEL&logo=github&logoColor=white&cacheSeconds=3600
```

| Parameter | Effect |
|---|---|
| `style` | `flat`, `flat-square`, `plastic`, `for-the-badge`, `social` |
| `color` / `labelColor` | Right / left background. Hex without `#`, or a named color |
| `label` | Override the left text. Empty `label=` hides it |
| `logo` / `logoColor` | [Simple Icons](https://simpleicons.org) slug and its color |
| `cacheSeconds` | How long the badge is cached |

Static badge: `https://img.shields.io/badge/LABEL-MESSAGE-COLOR`. In static paths, `-` separates segments, so write a literal dash as `--`, a literal underscore as `__`, and a space as `_` or `%20`.

## Catalogue

Replace `OWNER/REPO`, `PACKAGE` and `ci.yml`.

### Status

| Badge | URL |
|---|---|
| GitHub Actions (shields) | `https://img.shields.io/github/actions/workflow/status/OWNER/REPO/ci.yml?branch=main` |
| GitHub Actions (native, no shields) | `https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg` |
| Codecov coverage | `https://img.shields.io/codecov/c/github/OWNER/REPO` |
| OpenSSF Scorecard | `https://api.securityscorecards.dev/projects/github.com/OWNER/REPO/badge` |

### Version and compatibility

| Badge | URL |
|---|---|
| Latest GitHub release | `https://img.shields.io/github/v/release/OWNER/REPO` |
| npm version | `https://img.shields.io/npm/v/PACKAGE` |
| Node version required | `https://img.shields.io/node/v/PACKAGE` |
| PyPI version | `https://img.shields.io/pypi/v/PACKAGE` |
| Supported Python versions | `https://img.shields.io/pypi/pyversions/PACKAGE` |
| crates.io version | `https://img.shields.io/crates/v/CRATE` |
| License | `https://img.shields.io/github/license/OWNER/REPO` |

### Usage and credibility

| Badge | URL |
|---|---|
| Stars | `https://img.shields.io/github/stars/OWNER/REPO` |
| Forks | `https://img.shields.io/github/forks/OWNER/REPO` |
| Contributors | `https://img.shields.io/github/contributors/OWNER/REPO` |
| npm downloads (month / week / total) | `https://img.shields.io/npm/dm/PACKAGE`, `/npm/dw/`, `/npm/dt/` |
| PyPI downloads per month | `https://img.shields.io/pypi/dm/PACKAGE` |
| crates.io downloads | `https://img.shields.io/crates/d/CRATE` |
| Docker pulls | `https://img.shields.io/docker/pulls/USER/IMAGE` |
| Bundle size (min+gzip) | `https://img.shields.io/bundlephobia/minzip/PACKAGE` |

### Activity

| Badge | URL |
|---|---|
| Last commit | `https://img.shields.io/github/last-commit/OWNER/REPO` |
| Commit activity (`w`, `m`, `y`, `t`) | `https://img.shields.io/github/commit-activity/m/OWNER/REPO` |
| Open issues | `https://img.shields.io/github/issues/OWNER/REPO` |
| Closed PRs | `https://img.shields.io/github/issues-pr-closed/OWNER/REPO` |

### Community

| Badge | URL |
|---|---|
| Discord online count | `https://img.shields.io/discord/SERVER_ID` |
| Discord link, no count | `https://img.shields.io/badge/Discord-5865F2?logo=discord&logoColor=white` |
| Ask DeepWiki | `https://deepwiki.com/badge.svg` linking to `https://deepwiki.com/OWNER/REPO` |

## Custom and dynamic badges

For a metric no service provides (test count, benchmark result, model accuracy):

**Endpoint badge.** Commit a JSON file and point shields at its raw URL. A scheduled GitHub Action can rewrite the file.

```json
{ "schemaVersion": 1, "label": "tests", "message": "1,284 passing", "color": "2EA44F" }
```

```text
https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/OWNER/REPO/main/.github/badges/tests.json
```

Optional fields: `labelColor`, `namedLogo`, `logoColor`, `style`, `isError`.

**Dynamic JSON badge.** Reads one value from any public JSON URL with a JSONPath query:

```text
https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/OWNER/REPO/main/package.json&query=$.version&label=version
```

## Contributor and activity images

Images generated by third-party services. Good for a "Contributors" or "Community" section at the bottom. All are cached through GitHub's image proxy and can be hours to days stale.

**Contributor avatar grid** ([contrib.rocks](https://contrib.rocks)):

```html
<a href="https://github.com/OWNER/REPO/graphs/contributors">
  <img alt="Contributors to REPO" src="https://contrib.rocks/image?repo=OWNER/REPO&max=24&columns=12">
</a>
```

`max` caps avatars (default 100), `columns` sets the width (default 12), `anon=1` includes anonymous contributors. For an always-accurate list, a scheduled GitHub Action that writes contributors into the README as markdown (for example `akhilmhdh/contributors-readme-action`) avoids the image cache, at the cost of bot commits.

**Star history chart** ([star-history.com](https://www.star-history.com)): generate the current snippet on the site. It has used this shape:

```html
<a href="https://www.star-history.com/#OWNER/REPO&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=OWNER/REPO&type=Date&theme=dark">
    <img alt="Star history chart for OWNER/REPO" src="https://api.star-history.com/svg?repos=OWNER/REPO&type=Date">
  </picture>
</a>
```

Only worth showing once the curve is interesting.

**Activity dashboards** (Repobeats by Axiom) and **profile stats cards** (github-readme-stats) exist too. Repobeats needs a generated embed URL from its site. Public instances of stats-card services are often rate-limited or down; they fit personal profile READMEs, not project READMEs.
