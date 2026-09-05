# Skeletons

Copy-paste starting points. Everything here is Options API, no build step.

Versions below were current at the time of writing (Vue `3.5.42`, Vue Router `5.3.1`). Pin whatever exact version you use; check npm for a newer one only if the user cares. Vue Router 5 keeps the v4 API used here (`createRouter`, `createWebHashHistory`, `<router-view>`, `<router-link>`) and needs Vue >= 3.5.34.

## Which build to load

Two ways to load Vue without a bundler. Pick one per project and stay with it.

**ES modules + import map (default).** Native modules, clean `import` statements, matches how the code would look in a real project. Requires the page to be served over `http://` - opening `index.html` from the filesystem will not work. Any static server does: `npx serve`, `python -m http.server`, a VS Code Live Server.

**Global builds (`vue.global.js`).** Script tags, `Vue.createApp(...)`, no modules. The only reason to choose this: the app must run by double-clicking `index.html` from a `file://` path. Everything else about the skill applies unchanged.

Always use the **full** build (`vue.esm-browser.js` / `vue.global.js`), never `vue.runtime.*` - the runtime-only build has no template compiler, and every template here is a string.

Use `.prod.js` variants only if the user asks; the dev builds give real warnings, which is worth more on a prototype.

## index.html - ES modules

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>App</title>
  <link rel="stylesheet" href="styles.css">
  <!-- every dependency lives here -->
  <script type="importmap">
  {
    "imports": {
      "vue": "https://cdn.jsdelivr.net/npm/vue@3.5.42/dist/vue.esm-browser.js",
      "vue-router": "https://cdn.jsdelivr.net/npm/vue-router@5.3.1/dist/vue-router.esm-browser.js"
    }
  }
  </script>
</head>
<body>
  <div id="app" v-cloak></div>
  <script type="module" src="./app.js"></script>
</body>
</html>
```

To vendor the deps, download those two files into `vendor/` and change the import map values to `./vendor/vue.esm-browser.js` etc. Nothing else changes.

`styles.css` should start with `[v-cloak] { display: none; }` so the raw template never flashes.

## index.html - global builds (file:// fallback)

```html
<div id="app" v-cloak></div>
<script src="https://cdn.jsdelivr.net/npm/vue@3.5.42/dist/vue.global.js"></script>
<script src="https://cdn.jsdelivr.net/npm/vue-router@5.3.1/dist/vue-router.global.js"></script>
<script src="./app.js"></script>
```

Then `app.js` uses `const { createApp, reactive } = Vue;` and `const { createRouter, createWebHashHistory } = VueRouter;`, and every file is a plain script listed in `index.html` in dependency order. No `import`/`export` anywhere.

## app.js

```js
import { createApp } from 'vue';
import { store } from './state.js';
import { router } from './router.js';
import TodoRow from './components/TodoRow.js';

const App = {
  components: { TodoRow },
  data() {
    return { store, draft: '' };
  },
  computed: {
    remaining() {
      return this.store.todos.filter(t => !t.done).length;
    },
  },
  methods: {
    add() {
      const text = this.draft.trim();
      if (!text) return;
      this.store.todos.push({ id: crypto.randomUUID(), text, done: false });
      this.draft = '';
    },
  },
  template: /* html */ `
    <h1>Todos <small>{{ remaining }} left</small></h1>
    <form @submit.prevent="add">
      <input v-model="draft" placeholder="what next">
      <button :disabled="!draft.trim()">Add</button>
    </form>
    <p v-if="!store.todos.length">Nothing yet.</p>
    <ul v-else>
      <TodoRow
        v-for="todo in store.todos"
        :key="todo.id"
        :todo="todo"
        @remove="store.todos = store.todos.filter(t => t.id !== todo.id)"
      />
    </ul>
  `,
};

createApp(App).use(router).mount('#app');
```

Drop `.use(router)` and the import until the app actually has routes.

The `/* html */` comment before the template literal turns on HTML syntax highlighting in most editors. Cheap, worth keeping.

## A component - components/TodoRow.js

One file, one component, template inline with its logic.

```js
export default {
  name: 'TodoRow',
  props: {
    todo: { type: Object, required: true },
  },
  emits: ['remove'],
  computed: {
    label() {
      return this.todo.done ? `${this.todo.text} (done)` : this.todo.text;
    },
  },
  template: /* html */ `
    <li :class="{ done: todo.done }">
      <input type="checkbox" v-model="todo.done">
      <span>{{ label }}</span>
      <button @click="$emit('remove')">x</button>
    </li>
  `,
};
```

Register it locally in the parent's `components: { TodoRow }`. Use `app.component('TodoRow', TodoRow)` in `app.js` only for something genuinely used everywhere.

Props are read-only by convention. Mutating a passed object's fields (as `v-model="todo.done"` does above) is fine and idiomatic at this scale; replacing the prop itself is not. If the parent needs to know something happened, `emit`.

## state.js

One reactive object. This is the entire state layer until it demonstrably fails.

```js
import { reactive, watch } from 'vue';

export const store = reactive({
  todos: [],
  filter: 'all',
});

// optional: persistence, only if the app needs it
const saved = localStorage.getItem('todos');
if (saved) store.todos = JSON.parse(saved);
watch(() => store.todos, v => localStorage.setItem('todos', JSON.stringify(v)), { deep: true });
```

`watch` imported at module scope is not "using the Composition API" - it is a standalone reactivity utility. The rule is about component authoring style: components stay Options API.

Consume it by putting the object into `data()` (`data() { return { store } }`) and reading `store.x` in templates. It stays reactive because `reactive()` already made it so.

## router.js

```js
import { createRouter, createWebHashHistory } from 'vue-router';
import HomePage from './pages/HomePage.js';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: HomePage },
    { path: '/item/:id', component: () => import('./pages/ItemPage.js'), props: true },
    { path: '/:pathMatch(.*)*', component: { template: '<p>Not found.</p>' } },
  ],
});
```

`createWebHashHistory()` gives URLs like `#/item/3` and works on any static host with no configuration. Switch to `createWebHistory()` only when the server is set up to serve `index.html` for unknown paths.

Lazy `() => import(...)` works natively with ES modules and no bundler. Use it for pages that are big or rarely visited; a plain import is fine otherwise.

The root template then needs `<router-view></router-view>`, and links are `<router-link to="/item/3">`.

Route params reach the component as props when the route sets `props: true` - declare `props: { id: String }`. Otherwise read `this.$route.params.id`.

## services/

A service is just a module of functions. No classes, no injection, no interfaces.

```js
// services/api.js
const BASE = 'https://api.example.com';

export async function fetchItems() {
  const res = await fetch(`${BASE}/items`);
  if (!res.ok) throw new Error(`items: ${res.status}`);
  return res.json();
}
```

Call it from a component method or `mounted()`, and keep loading/error flags in that component's `data()`:

```js
data() {
  return { items: [], loading: false, error: '' };
},
async mounted() {
  this.loading = true;
  try {
    this.items = await fetchItems();
  } catch (e) {
    this.error = e.message;
  } finally {
    this.loading = false;
  }
},
```

That three-field pattern is the whole error-handling story for a prototype. Do not build anything larger around it.
