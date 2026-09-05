# Pitfalls

Failure modes that show up specifically when an LLM writes no-build Vue 3. Each one is wrong output, then the fix.

## Vue 2 syntax in a Vue 3 app

Training data is full of Vue 2. Symptoms and replacements:

| Vue 2 | Vue 3 |
| --- | --- |
| `new Vue({ el: '#app' })` | `createApp(App).mount('#app')` |
| `Vue.component('x', {...})` | `app.component('x', {...})` |
| `filters: { ... }` and `{{ x \| f }}` | removed - use a `computed` or a method |
| `$listeners`, `$children` | removed - `$attrs` covers listeners |
| `.sync` modifier | `v-model:propName` |
| `v-model` on a component = `value` + `input` | `modelValue` prop + `update:modelValue` emit |
| `$on` / `$emit` as an event bus | removed - use shared `reactive` state |
| `beforeDestroy` / `destroyed` | `beforeUnmount` / `unmounted` |
| root template must have one element | multiple root nodes are allowed |
| `v-for` + `v-if` on the same element | still legal in 3 but `v-if` now wins; wrap in `<template v-for>` |
| `key` on `<template v-for>` children | `key` goes on the `<template>` |

`app.config.globalProperties` replaces `Vue.prototype.$x`. Rarely needed here.

## Mixing Options and Composition API

Wrong in an Options project: a `setup()` block, `ref()`/`computed()` called inside a component, `<script setup>` (which does not exist without a compiler anyway), `defineProps`/`defineEmits`.

`reactive()` and `watch()` used at module scope in `state.js` are fine - those are reactivity utilities, not a component authoring style. Inside components: `data`, `computed`, `methods`, `watch` (the option), lifecycle hooks.

## No-build violations

- **A `.vue` file.** There is no compiler. Components are `.js` files exporting an object with a `template` string.
- **`<script setup>`.** Same reason.
- **`import x from 'some-npm-package'`** where the import map defines no `some-npm-package`. Every bare specifier must appear in the import map in `index.html`, or the browser throws. Relative paths (`./state.js`) need the `.js` extension - the browser does not resolve extensions.
- **`vue.runtime.*` build** with string templates - no compiler, blank page, console warning about the runtime-only build.
- **ES modules over `file://`.** CORS blocks module loading from the filesystem. Serve over http, or switch to global builds.
- **TypeScript.** The browser has no TypeScript parser, so an annotation is a syntax error that kills the whole module - not a stylistic slip. No `.ts` files, no `: string`, no interfaces, no generics, no `as` casts, no `enum`. JSDoc comments are the only typing available without a build, and are usually not worth it at this scale. If types are genuinely wanted, that is a Vite project.
- **`process.env`, `require`, `__dirname`, `import.meta.env`.** None exist. Configuration goes in a plain `config.js` exporting an object.

## Manual DOM work replacing Vue bindings

Any of these in component code is a smell: `document.querySelector`, `classList.add/remove/toggle`, `el.style.display`, `innerHTML`, reading a value out of a `data-` attribute, `addEventListener` for something a `@click` covers.

Replace with state plus a binding. If a value can be inferred from other state, it is a `computed`, not a field you keep in sync by hand.

Legitimate exceptions: focusing an input (`this.$refs.input.focus()`), scrolling, canvas, measuring an element, wiring a `keydown` listener on `window` in `mounted` (and removing it in `unmounted`).

## Duplicated state

- A prop copied into `data()` and then edited independently - the two drift. Either emit up, or make the local copy explicitly the source of truth and stop reading the prop.
- The same value in `data` and in `store` - pick one.
- A `watch` that writes field B whenever field A changes, when B is just a function of A. That is a `computed`.
- localStorage read on every access instead of once at load.

## Over-engineering

- **Pinia** for shared state. One `reactive({})` in `state.js` handles a prototype. Add Pinia only when the user asks.
- **Routes for UI state.** A modal, tab, dropdown, or wizard step is a `data` field. It becomes a route only when the user wants a shareable URL or back-button support for it.
- **A service layer / repository / factory / composable** wrapping a single `fetch`. Export a function.
- **A generic base component** built before there are two concrete users of it.
- **Validation frameworks, error boundaries, retry logic, logging infrastructure** on a personal tool.
- **Tests, CI, a docs tree** added unprompted.

Build the direct version, confirm it runs, then ask whether the abstraction is wanted.

## Scope creep during edits

Reformatting a file you were only asked to add a line to. Renaming things for consistency. "While I was in there" refactors. Rewriting a working component into your preferred shape. All of it produces large diffs that are hard to review and hard for the next LLM to reason about.

The only unasked cleanup that is in scope: replacing manual DOM synchronisation inside the exact code you are already changing.

## Overclaiming

Do not call a prototype production-ready, secure, or fully tested. Report what you actually checked - and since the default on a prototype is to hand the change back rather than verify it yourself, "I have not run this" is a normal, fine thing to say. What is not fine is implying you looked when you did not.

## Fast debugging checklist

For when the developer reports a symptom, or when you are running unattended and something is clearly wrong. Not a routine pass after every edit.

Blank page, no error: check the mount target `#app` exists and `mount()` ran; check you are on the full build, not runtime-only.

`[Vue warn]: Failed to resolve component` - the component is not in the parent's `components` option, or the name in the template does not match (`TodoRow` / `todo-row` both work if registered as `TodoRow`).

Nothing updates when data changes - the value is not reactive: assigned to a plain object outside `data()`/`reactive()`, or you replaced a reactive object with a new plain one, or destructured it (`const { todos } = store` loses reactivity for reassignments).

`Uncaught TypeError: Failed to resolve module specifier` - a bare import with no import map entry.

Route renders nothing - missing `<router-view>`, or `app.use(router)` was never called.

404 on a deep link with `createWebHistory` - switch to `createWebHashHistory` or configure the server fallback.
