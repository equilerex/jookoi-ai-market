---
name: jookoi-vue3-vibe-code
description: The default architecture for building a small web app fast - Vue 3 and Vue Router loaded from a CDN or a local copy, native ES modules, plain HTML and CSS, Options API, no build step and no .vue files. Use this whenever the user wants an MVP, prototype, vibe-coded app, internal tool, dashboard, admin page, or "quick little thing" and has not named a stack, since this skill picks the stack for them. Use it just as much when they do say Vue but no bundler, when they say no-build / CDN / single HTML file, or when a project already has an index.html loading Vue via script tag or import map - including small follow-ups like "add a page", "add a route", "make this filterable". It owns the architecture and the prototype-not-production posture, so it complements the narrower vue-* reference skills rather than competing with them. Skip only for an existing Vite, Nuxt, SFC, or TypeScript project.
---

# jookoi-vue3-vibe-code

Prototype-grade Vue 3 in the browser. No build step, no toolchain, no ceremony. The deliverable is a working app that stays legible after ten rounds of LLM edits.

**New project** → *Start here*, and read `references/skeletons.md` before the first file.
**Existing project** → *Editing an existing project*, and read `index.html` first to learn which loading style it uses.

When the user asked for "a quick tool" without naming a stack, this is the answer: say in one line that you are building it as a no-build Vue page so they can change course, then build it. Do not open a stack discussion - picking a sane default fast is the whole point.

This skill sets the architecture and the posture. The narrower Vue skills (`vue-options-api-best-practices`, `vue-router-best-practices`, `vue-debug-guides`) are detail references that sit underneath it: reach for them when you need specifics on an option, a navigation guard, or an error message. Where they assume a build step or an SFC, this skill wins - that assumption is the one thing it exists to remove.

## The stack, fixed

Allowed: Vue 3 (browser build, CDN or vendored locally), Vue Router (same), plain modern JavaScript in native ES modules, HTML, CSS, the Options API.

The defining constraint: every file the browser loads is a file you could drop on a static server or open directly. Nothing gets compiled, transpiled, or bundled on the way there. Two different things follow from that, and they are worth keeping apart.

**Impossible here, because a browser cannot execute them.** TypeScript, `.vue` single-file components, JSX. These are not preferences - there is no runtime that reads them. Wanting any of them means wanting a build step, which means a different project (a Vite scaffold), not a variation on this one. Say that plainly and offer to set one up; do not hand-wave, and do not quietly write `.ts` files that will never run.

**Possible but not warranted by default.** Pinia, UI component libraries, CSS frameworks, test runners, CI. Most ship a browser build and could be loaded from a CDN, so these are genuinely the user's call - see below.

Installed dependencies (`package.json`, `node_modules`, a package manager) belong to the first group in practice: nothing here resolves bare module specifiers except your import map. A CDN URL is fine even though it serves npm-published files - what is out is the install step, not the origin.

The Options API is the house style because there is no compiler to make anything else pleasant. Don't mix Composition API component authoring (`setup()`, `<script setup>`, `ref`, `computed()` called inside a component) into an Options API project, or vice versa - the point is that any file looks like every other file, so the next edit lands somewhere predictable. Pick what the project already does; on a new project, Options API.

`reactive()` and `watch()` imported at module scope in `state.js` are the exception, and not really an exception: they are standalone reactivity utilities, not a component authoring style. Components stay Options API.

### When the user asks for something off the list

For the second group, say what it costs in one sentence - usually a chunk of the app's simplicity for a problem it does not have yet - offer the small hand-rolled alternative if one exists, then build whichever they pick. A silent refusal is unhelpful and a silent dependency is worse. Their call, made with the tradeoff visible.

For the first group, the honest answer is different: this is no longer a no-build project. Say so, and offer to scaffold it properly with Vite instead of pretending it fits here. That is a real, reasonable thing for them to want - it just is not this skill.

## Not production software

These apps are personal, disposable, or a small internal tool. Do not add layered architecture, exhaustive validation, auth hardening, error-handling frameworks, telemetry, migrations, or a docs tree. Add any of that only when the user asks or the app visibly breaks without it. Never describe the result as production-ready.

When requirements are ambiguous, build the smallest thing that fits the existing app. Ask only when two readings produce materially different apps.

## Start here

One file is a legitimate architecture. `index.html` with a `<script type="module">` is the right answer until it is not.

Split only when a file gets hard to navigate, roughly in this order:

```
index.html        deps + mount point + <div id="app">
app.js            createApp, global components, mount
styles.css
router.js         only once navigation has real URL meaning
state.js          only once two pages share state
components/       one file per component, template inline
pages/            route components
services/         fetch wrappers, storage, external APIs
```

Do not create a folder to satisfy the diagram. Template lives in the same file as its component logic, always.

Copy-paste skeletons for `index.html`, a component, `router.js`, and `state.js`: `references/skeletons.md`. Read it before writing the first file of a new project, and when adding a router or a state module to an existing one.

## Write declarative Vue, not DOM code

State drives the DOM. If you find yourself calling `classList`, `style.display`, `innerHTML`, `querySelector`, or storing a value in a `data-` attribute, that is a bug: move the value into `data`/`computed` and bind it.

- visibility: `v-if` (unmount) / `v-show` (toggle display)
- lists: `v-for` with a stable `:key`
- forms: `v-model`
- presentation: `:class` / `:style`
- derived values: `computed` - never a method that recomputes on every render, never a `watch` that assigns to another field
- user actions: `methods`
- component talk: `props` down, `emits` up

## State ownership

One rule: state lives at the lowest level that can own it.

- Used by one component → that component's `data()`.
- Shared across pages or components → one `reactive({})` object in `state.js`, imported where needed. That is the whole state management story. No Pinia, no event bus, no provide/inject tree until the single object genuinely stops working.
- Derived from other state → `computed`. Never a second copy.

Never keep the same fact in two places (Vue state and the DOM, Vue state and localStorage read on every render, a prop copied into `data` and then diverging).

## Router

Add Vue Router when a URL genuinely means something: a page worth bookmarking, sharing, or reaching with the back button. Use `createWebHashHistory()` unless the host is configured to serve `index.html` for unknown paths.

Not routes: tabs, modals, dropdowns, accordions, wizard steps, selected rows, sidebar open/closed. Those are ordinary state. Promote one to a route only when the user asks for a deep link, a shareable URL, or back-button behavior.

## Dependencies

Pin exact versions - never `@latest`, never a floating major. Keep every dependency visible in one place: the import map or script tags in `index.html`.

Vendor copies into `vendor/` when the app must work offline or must still run in a year. Adding a package manager or a build step to solve a dependency problem at this scale trades the one property the project was built for - it runs by opening a file - for tooling that will rot faster than the app does.

## CSS

One `styles.css`, plain CSS, no framework unless asked. Start it with `[v-cloak] { display: none; }` so the raw template never flashes before Vue mounts.

There is no `<style scoped>` without single-file components, so component styles are global. Prefix each component's classes with the component name (`.todo-row`, `.todo-row__done`) and the collisions stop being a problem. That is cheaper than any scoping mechanism you could add.

## Editing an existing project

1. Read the files you are about to touch, plus `index.html` for the dependency list and the app's shape.
2. Search before adding: is there already a route, a state field, a component, or a service doing this?
3. Keep the project's existing structure and naming when it is coherent, even if you would have picked differently.
4. Make the smallest change that solves the request. Do not touch unrelated files, do not restyle working code.
5. Do replace manual DOM synchronisation you encounter *in the code you are already editing* with Vue bindings. Leave the rest alone.
6. Hand it back and say what to look at. See below.

## Verification: the developer has the page open

Assume it. Someone is sitting there with the app on screen, and a broken render is obvious to them in one second - faster and cheaper than you loading a page, starting a server, screenshotting, and reasoning about what you see. On a prototype, that human glance *is* the test suite, and it is a good one.

So the default after a change is: state what changed and what to look at, then stop. Do not open the app, do not spawn a server, do not write a check to prove an edit landed. Verification loops are the single biggest waste of time and tokens in this kind of work, and they buy almost nothing when a person is already watching.

Batch whatever verification you do decide is worth it. Finish a coherent chunk of work first - the whole feature, not each edit inside it - then check once. Checking after every file leaves you with mostly-empty results and a much longer session.

Verify yourself when the human glance genuinely cannot cover it:

- You are running unattended - a long autonomous stretch with nobody watching. Even then, check at chunk boundaries, not after each edit.
- The change is invisible on screen: a data transform, a parser, a sort order, an export format, something behind a request.
- You changed something you cannot reason about confidently, or you are three failed attempts deep and guessing.
- The user asked you to.

When you do check, check once and check the thing you changed - no full regression sweep of the app.

One fact worth knowing before you claim anything is broken: the import-map setup needs the page served over `http://`. Opening `index.html` from the filesystem fails with a module/CORS error that has nothing to do with the code. Global-build projects (script tags, `Vue.createApp`) work fine from `file://`. If a page is blank, decide which of the two you are looking at before diagnosing further - `references/pitfalls.md` has the rest of the checklist.

## Testing is optional and proportional

Do not add tests by default. Do not introduce Vitest, Vue Test Utils, or Playwright unless the project already has them or the user asks.

Worth a small test: a non-trivial data transformation, fiddly filter/sort logic, a reusable utility, a state or route transition that keeps breaking, a regression that was already reported once. These share a shape - logic with a right answer that is tedious to eyeball. Put it in a plain `test.html` or a `*.test.js` run by hand, and test behaviour, not internals.

Everything else - visual tweaks, modal toggles, static pages, obvious CRUD - is verified by looking at it, which the developer is already doing.

## Performance and abstraction

Optimise nothing until something is visibly slow. No composables, stores, factories, repositories, service layers, or generic base components invented for a future that has not arrived. A local method beats a new module.

Build the simple version, confirm it works, and only then consider whether an abstraction earns its place.

## Known failure modes

Reading your own diff is free, so do that even when you skip everything else. These are the ones that come from training data rather than from the project in front of you, which is why they slip through. Details and fixes: `references/pitfalls.md`.

- Vue 2 syntax in a Vue 3 app (`new Vue`, `Vue.component` global, `filters`, `$listeners`, `.sync`, `v-model` on a component meaning `value`/`input`).
- Composition API leaking into an Options API project.
- A `.vue` file, a `<script setup>` block, or a bare `import` of a package name no import map defines.
- Type annotations, `.ts` files, interfaces, or generics slipping into what the browser parses as plain JavaScript - a syntax error, not a style choice.
- Assuming a bundler exists: `process.env`, `import.meta.env`, `require`, extensionless relative imports.
- Loading `vue.runtime.*` - no template compiler, blank page.
- Declaring a prototype production-ready, secure, or tested.

## Reporting

Short. What changed, which files, any assumption you made, what to look at in the running app, and anything still missing or broken. If you did verify something, say what; if you did not, do not imply you did. No architecture essays unless asked.
