#!/usr/bin/env node
// Static performance audit for an Angular workspace. Zero dependencies, Node 18+.
// Usage: node audit.mjs [projectRoot] [--latest]
//   --latest  also asks npm for the newest @angular/core (network call)
// Output is a markdown report of heuristic findings. Every finding is a lead to
// verify, not a verdict: regexes cannot see types, and some hits are intentional.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { execSync } from 'node:child_process';

// Bump together with README.md "Provenance" when the skill is re-verified.
const BASELINE_MAJOR = 22;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.angular', '.git', 'coverage', '.nx', 'out-tsc']);
const MAX_HITS = 8;
const BIG_SRC_BYTES = 30_000;

const args = process.argv.slice(2);
const root = args.find((a) => !a.startsWith('--')) ?? process.cwd();
const wantLatest = args.includes('--latest');

const findings = { high: [], medium: [], info: [] };
const add = (sev, title, detail, hits = []) => findings[sev].push({ title, detail, hits });

const readJson = (p) => {
  try {
    // angular.json may carry comments in some workspaces
    return JSON.parse(readFileSync(p, 'utf8').replace(/^\s*\/\/.*$/gm, ''));
  } catch {
    return null;
  }
};

// ---------- version ----------
function detectVersion() {
  const installed = readJson(join(root, 'node_modules/@angular/core/package.json'))?.version;
  const declared = (() => {
    const pkg = readJson(join(root, 'package.json'));
    return pkg?.dependencies?.['@angular/core'] ?? pkg?.devDependencies?.['@angular/core'];
  })();
  const raw = installed ?? declared;
  const major = raw ? Number((raw.match(/\d+/) ?? [])[0]) : NaN;
  return { installed, declared, major };
}

const ver = detectVersion();
if (Number.isNaN(ver.major)) {
  console.log(`No @angular/core found under ${root}. Point the script at the workspace root.`);
  process.exit(1);
}

let latestMajor = NaN;
if (wantLatest) {
  try {
    const latest = execSync('npm view @angular/core version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    latestMajor = Number(latest.split('.')[0]);
  } catch {
    // offline or npm missing; the local check still stands
  }
}

// ---------- files ----------
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (['.ts', '.html'].includes(extname(name)) && !name.endsWith('.spec.ts') && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const srcRoots = ['src', 'projects', 'apps', 'libs'].map((d) => join(root, d)).filter(existsSync);
const files = srcRoots.flatMap((d) => walk(d)).map((p) => ({ p, rel: relative(root, p), text: readFileSync(p, 'utf8') }));

const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;

// Collect `file:line` hits for a regex across files, optionally filtered per file.
function scan(re, { only, fileFilter, matchFilter } = {}) {
  const hits = [];
  for (const f of files) {
    if (only && !only.includes(extname(f.p))) continue;
    if (fileFilter && !fileFilter(f)) continue;
    for (const m of f.text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
      if (matchFilter && !matchFilter(m, f)) continue;
      hits.push(`${f.rel}:${lineOf(f.text, m.index)}`);
    }
  }
  return hits;
}
const anyFile = (re) => files.some((f) => re.test(f.text));

// ---------- angular.json ----------
const ngJson = readJson(join(root, 'angular.json'));
const projects = ngJson?.projects ?? {};
let usesZoneJsPolyfill = false;

for (const [name, proj] of Object.entries(projects)) {
  const build = proj?.architect?.build ?? proj?.targets?.build;
  if (!build) continue;
  const builder = build.builder ?? '';
  const prod = build.configurations?.production ?? {};
  const opts = { ...build.options, ...prod };
  const polyfills = [].concat(build.options?.polyfills ?? []);
  if (polyfills.some((p) => String(p).includes('zone.js'))) usesZoneJsPolyfill = true;

  if (/:browser$|build-webpack|custom-webpack/.test(builder)) {
    add('high', `[${name}] legacy webpack builder \`${builder}\``,
      'Migrate to `@angular/build:application` (esbuild). Faster builds, and the stats output becomes an esbuild metafile. `ng update` offers the migration.');
  }
  if (proj.projectType === 'application') {
    const budgets = opts.budgets ?? [];
    const initial = budgets.find((b) => b.type === 'initial');
    if (!initial) {
      add('high', `[${name}] no \`initial\` bundle budget in production config`,
        'Add `{ "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" }` (tune to current size + small headroom) so regressions fail the build.');
    } else if (initial.maximumError && parseSize(initial.maximumError) > 2 * 1024 * 1024) {
      add('medium', `[${name}] \`initial\` budget error at ${initial.maximumError}`,
        'A budget this loose hides regressions. Set it just above the current initial size.');
    }
    if (opts.optimization === false) add('high', `[${name}] \`optimization: false\` in production`, 'Production builds must minify, tree-shake and inline critical CSS.');
    if (opts.sourceMap === true) add('info', `[${name}] production \`sourceMap: true\``, 'Fine for error tracking if maps are not served publicly. Needed temporarily for `source-map-explorer`.');
  }
}

function parseSize(s) {
  const m = String(s).match(/([\d.]+)\s*(kb|mb|b)?/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = (m[2] ?? 'b').toLowerCase();
  return unit === 'mb' ? n * 1024 * 1024 : unit === 'kb' ? n * 1024 : n;
}

// ---------- change detection ----------
const zoneless = anyFile(/provideZonelessChangeDetection\s*\(/);
const zoneProvider = anyFile(/provideZoneChangeDetection\s*\(/);
const coalescing = anyFile(/eventCoalescing\s*:\s*true/);

const experimentalZoneless = scan(/provideExperimentalZonelessChangeDetection/, { only: ['.ts'] });
if (experimentalZoneless.length) {
  add('medium', 'stale zoneless provider name', 'Renamed to `provideZonelessChangeDetection()` (stable since 20.2).', experimentalZoneless);
}

// Zoneless is the default for new apps since v21, so a v21+ app with no zone.js polyfill and no
// zone provider is already zoneless. Only report zone.js when it is explicitly wired in.
if (!zoneless && (usesZoneJsPolyfill || zoneProvider)) {
  add('info', ver.major >= 21 ? 'leftover: app still ships zone.js on v' + ver.major : 'app runs on zone.js',
    'Zoneless removes zone.js (~10-13 KB gzip) and needless CD cycles, but only after OnPush + signals are in place and third-party libs are checked. Optional, not a defect. See references/change-detection.md for the migration order.');
  if (zoneProvider && !coalescing) add('info', 'explicit `provideZoneChangeDetection` without event coalescing', 'Only relevant if the app stays on zone.js: add `eventCoalescing: true`.');
}
if (zoneless && usesZoneJsPolyfill) {
  add('medium', 'zoneless provider but zone.js still in polyfills', 'Remove `zone.js` from `polyfills` in angular.json (and test config) to drop the bytes.');
}

const componentFiles = files.filter((f) => extname(f.p) === '.ts' && /@Component\s*\(/.test(f.text));
// v22+: OnPush is the default, so missing `OnPush` is never a finding. Only explicit opt-outs are worth a look.
if (ver.major >= 22) {
  const optedOut = scan(/ChangeDetectionStrategy\.(Default|Eager)\b/, { only: ['.ts'] });
  if (optedOut.length) add('info', `${optedOut.length} component(s) explicitly opt out of OnPush`, 'OnPush is the default since v22. Each eager component is a subtree checked on every cycle; confirm each one needs it.', optedOut);
} else {
  const noOnPush = componentFiles.filter((f) => !/ChangeDetectionStrategy\.OnPush/.test(f.text));
  if (noOnPush.length) {
    add('high', `${noOnPush.length}/${componentFiles.length} components without OnPush`,
      `Before v22 the default is eager checking. Add \`changeDetection: ChangeDetectionStrategy.OnPush\`, leaf components first.`,
      noOnPush.map((f) => f.rel));
  }
}

// ---------- templates ----------
const tpl = ['.html', '.ts'];
const legacyCf = scan(/\*ng(If|For|Switch)\b/, { only: tpl });
if (legacyCf.length) add('medium', `${legacyCf.length} structural directive(s) \`*ngIf/*ngFor/*ngSwitch\``, 'Migrate with `ng generate @angular/core:control-flow`. `@for` enforces `track` and runs faster than `*ngFor`.', legacyCf);

// Regexes cannot see types. `track item` is correct for primitives (strings, numbers), which is common
// (chips, colors, ids). Only object items that get re-fetched rebuild every row, so this stays info.
const identityTrack = scan(/@for\s*\(\s*(\w+)\s+of\s+[^;]+;\s*track\s+(\w+)\s*[;)]/, {
  only: tpl,
  matchFilter: (m) => m[1] === m[2],
});
if (identityTrack.length) add('info', `${identityTrack.length} \`@for\` tracking the item itself (\`track item\`)`, 'Correct when items are primitives (strings, numbers). Only object items that are re-created on each fetch rebuild every row, and only then use `track item.id`. Check the collection type before changing anything.', identityTrack);

const indexTrack = scan(/track\s+\$index\b/, { only: tpl });
if (indexTrack.length) add('info', `${indexTrack.length} \`track $index\``, 'Fine for static lists. For lists that insert, remove or reorder, track a stable id.', indexTrack);

const ngForNoTrackBy = scan(/\*ngFor="(?![^"]*trackBy)[^"]*"/, { only: tpl });
if (ngForNoTrackBy.length) add('high', '`*ngFor` without `trackBy`', 'Every change re-creates DOM rows. Add `trackBy` or migrate to `@for (...; track item.id)`.', ngForNoTrackBy);

// Calls with arguments inside interpolation or property bindings. Zero-arg calls are
// skipped because they are usually signal reads, which are cheap and idiomatic.
const tplCall = scan(/(\{\{[^}]*\b[a-zA-Z_]\w*\([^)\s][^)]*\)[^}]*\}\}|\[[\w.-]+\]="[^"]*\b[a-zA-Z_]\w*\([^)\s][^)]*\)[^"]*")/, {
  only: tpl,
  matchFilter: (m) => !/\$any\(|\|\s*\w+\s*:/.test(m[0]),
});
if (tplCall.length) add('medium', `${tplCall.length} template binding(s) calling a function with arguments`,
  'Runs on every CD cycle that checks this view. Move to `computed()`, a pure pipe, or a precomputed field. Getters have the same cost as methods.', tplCall);

const imgNoNgSrc = scan(/<img\b(?![^>]*\bngSrc\b)[^>]*>/, { only: tpl });
if (imgNoNgSrc.length) add('medium', `${imgNoNgSrc.length} \`<img>\` without \`ngSrc\``, 'Use `NgOptimizedImage`: enforced width/height (no CLS), lazy by default, srcset, `priority` for the LCP image.', imgNoNgSrc);
if (anyFile(/\bngSrc\b/) && !anyFile(/\bngSrc\b[^>]*\bpriority\b|\bpriority\b[^>]*\bngSrc\b/)) {
  add('medium', 'no `ngSrc` image marked `priority`', 'If the LCP element is an image, add `priority` (fetchpriority=high, eager, preload under SSR). Angular warns about this in dev mode.');
}

// ---------- loading ----------
const lazyRoutes = scan(/\bload(Children|Component)\s*:/, { only: ['.ts'] });
const hasRoutes = anyFile(/\bprovideRouter\s*\(|RouterModule\.for(Root|Child)\(/);
if (hasRoutes && !lazyRoutes.length) add('high', 'no lazy routes', 'Every route is in the initial bundle. Use `loadComponent` / `loadChildren` for everything except the landing route.');
else if (lazyRoutes.length) add('info', `${lazyRoutes.length} lazy route(s)`, 'Check that eager code does not import from lazy features (directly or via a barrel), which pulls them back into main.');

// Eager route components: the landing route and the shell are eager by definition, so check what they import.
const eagerRoutes = scan(/component\s*:\s*[A-Z]\w*/, { only: ['.ts'], fileFilter: (f) => /path\s*:/.test(f.text) });
if (eagerRoutes.length) add('info', `${eagerRoutes.length} eager \`component:\` route(s)`, 'An eager route puts its whole static import closure into the initial bundle. Confirm each one needs to be eager, and check what it imports (a table or chart stack, a data module). `scripts/route-cost.mjs` prices lazy routes when a stats file exists.', eagerRoutes);

// Stats file leads (only when a build with statsJson exists). Failed builds write none.
const statsFile = (() => {
  const dist = join(root, 'dist');
  if (!existsSync(dist)) return null;
  for (const d of readdirSync(dist)) {
    const p = join(dist, d, 'stats.json');
    if (existsSync(p)) return p;
  }
  return null;
})();
if (statsFile) {
  const stats = readJson(statsFile);
  const outs = Object.entries(stats?.outputs ?? {}).filter(([n]) => n.endsWith('.js') || n.endsWith('.css'));
  const dyn = new Set(outs.flatMap(([, o]) => (o.imports ?? []).filter((i) => i.kind === 'dynamic-import').map((i) => i.path)));
  const initialEntries = outs.filter(([n, o]) => o.entryPoint && !dyn.has(n));
  const bigSrc = [];
  for (const [n, o] of initialEntries) {
    for (const [input, v] of Object.entries(o.inputs ?? {})) {
      if (!input.includes('node_modules') && v.bytesInOutput > BIG_SRC_BYTES) bigSrc.push(`${input} (${(v.bytesInOutput / 1000).toFixed(0)} kB in ${n})`);
    }
  }
  if (bigSrc.length) add('medium', `${bigSrc.length} application source file(s) over ${BIG_SRC_BYTES / 1000} kB inside an initial entry`,
    'Data modules, fixtures or generated content imported by the shell or landing route. Often imported for one small use (a `.length`, a lookup). Lazy-load it or precompute the value.', bigSrc);
  add('info', `stats file found: ${relative(root, statsFile)}`, 'Run `node scripts/route-cost.mjs <stats file>` for per-route cost and `node scripts/chunk-packages.mjs <stats file> initial` for a per-package breakdown.');
}

const deferCount = scan(/@defer\b/, { only: tpl }).length;
add('info', `${deferCount} \`@defer\` block(s)`, deferCount ? 'Check none wrap above-the-fold content without SSR + `hydrate` triggers (CLS).' : 'Candidates: charts, maps, editors, comments, anything below the fold.');

const preloadAll = scan(/PreloadAllModules/, { only: ['.ts'] });
if (preloadAll.length) add('info', '`PreloadAllModules`', 'Fetches every lazy chunk after each navigation and ignores `canMatch` and network state. Fine for small apps with few gated routes. Check lazy total size and gated routes before changing. See references/preloading.md.', preloadAll);
const customPreload = scan(/withPreloading\s*\(\s*(?!PreloadAllModules|NoPreloading)\w+|implements\s+PreloadingStrategy|QuicklinkStrategy|ngx-quicklink|ngx-hover-preload/, { only: ['.ts'] });
if (customPreload.length) add('info', 'custom or third-party preloading strategy', 'Review against references/preloading.md (canMatch-gated routes, network gate, package maintenance). Do not replace unprompted.', customPreload);
if (hasRoutes && lazyRoutes.length >= 8 && !anyFile(/withPreloading\s*\(|preloadingStrategy\s*:/)) {
  add('info', `${lazyRoutes.length} lazy routes on default NoPreloading`, 'Often correct. Only consider a selective strategy if measurement shows chunk waits on likely-next navigations. See references/preloading.md.');
}

const heavyImports = scan(/from\s+['"](lodash|moment|moment-timezone|rxjs\/compat)['"]/, { only: ['.ts'] });
if (heavyImports.length) add('high', 'whole-library import of a non-tree-shakable package', '`lodash` → `lodash-es` per-function imports or native code; `moment` → `date-fns` / `Intl` / Temporal.', heavyImports);

const syncAnimations = scan(/\bprovideAnimations\s*\(|BrowserAnimationsModule/, { only: ['.ts'] });
if (syncAnimations.length) add('medium', 'eager `@angular/animations` provider',
  'The animations package is legacy (native `animate.enter` / `animate.leave` since v20.2). At minimum switch to `provideAnimationsAsync()` so the engine loads lazily.', syncAnimations);

// ---------- SSR ----------
const ssr = existsSync(join(root, 'src/server.ts')) || anyFile(/provideServerRendering\s*\(/);
if (ssr) {
  if (!anyFile(/provideClientHydration\s*\(/)) add('high', 'SSR without `provideClientHydration()`', 'Without hydration the client destroys and re-renders the server DOM: flicker and wasted work.');
  const oldServerRouting = scan(/provideServerRouting\s*\(/, { only: ['.ts'] });
  if (oldServerRouting.length) add('medium', 'v19-era `provideServerRouting`', 'Replaced by `provideServerRendering(withRoutes(serverRoutes))` in v20.', oldServerRouting);
}

// ---------- subscriptions ----------
const leaky = componentFiles.filter((f) => /\.subscribe\(/.test(f.text) && !/takeUntilDestroyed|DestroyRef|ngOnDestroy|\btake\(1\)|\bfirst\(\)/.test(f.text));
if (leaky.length) add('medium', `${leaky.length} component(s) subscribe with no visible teardown`,
  'Prefer `toSignal()` / `async` pipe; otherwise `takeUntilDestroyed()`. HttpClient one-shots complete on their own, so check before changing.', leaky.map((f) => f.rel));

// ---------- report ----------
const out = [];
out.push(`# Angular performance audit: ${relative(process.cwd(), root) || '.'}`);
out.push('');
out.push(`- @angular/core: ${ver.installed ?? '(not installed)'} installed, \`${ver.declared ?? '?'}\` declared`);
out.push('- **Read-only report.** Findings are leads. Legacy leftovers on a newer major may be deliberate; do not change code until the user picks items.');
out.push(`- change detection: ${zoneless ? 'zoneless' : usesZoneJsPolyfill || zoneProvider ? 'zone.js' : 'unknown'} | SSR: ${ssr ? 'yes' : 'no'} | files scanned: ${files.length}`);
if (ver.major > BASELINE_MAJOR) out.push(`- **Skill may be stale:** project is on v${ver.major}, skill verified against v${BASELINE_MAJOR}. Run the refresh checklist in README.md before trusting version-sensitive advice.`);
if (ver.major < BASELINE_MAJOR) out.push(`- Project is on v${ver.major}, older than the v${BASELINE_MAJOR} baseline. Check references/version-notes.md before recommending an API.`);
if (latestMajor > BASELINE_MAJOR) out.push(`- **npm latest is v${latestMajor}**, newer than the skill baseline v${BASELINE_MAJOR}. Skill needs a refresh.`);
out.push('');
for (const sev of ['high', 'medium', 'info']) {
  if (!findings[sev].length) continue;
  out.push(`## ${sev}`);
  out.push('');
  for (const f of findings[sev]) {
    out.push(`- **${f.title}**: ${f.detail}`);
    for (const h of f.hits.slice(0, MAX_HITS)) out.push(`  - \`${h}\``);
    if (f.hits.length > MAX_HITS) out.push(`  - ...and ${f.hits.length - MAX_HITS} more`);
  }
  out.push('');
}
out.push('Static heuristics only. Confirm with `ng build --configuration production`, a build with `statsJson` enabled, and Lighthouse before changing code.');
console.log(out.join('\n'));
