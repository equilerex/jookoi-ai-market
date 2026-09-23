#!/usr/bin/env node
// Per-route cost from an esbuild metafile (stats.json). Zero dependencies, Node 18+, read-only.
// Usage: node route-cost.mjs <stats.json | dist/<project>> [--min-kb=N] [--all] [--preloaded=<entry substring>] [--json]
//
// Initial set   = entry outputs that nothing reaches through a dynamic import(), plus everything
//                 they pull in through static imports. CSS entries count too.
// Route cost    = a lazy entry chunk (target of a dynamic import) plus its static-import closure
//                 that is not already in the initial set. That is what a user downloads on top of
//                 the initial bundle when they open that route.
// --preloaded=<text> treats every lazy chunk whose entryPoint or chunk name contains <text> as already
//                 loaded at startup (a shell that calls import() on boot), so its closure joins the
//                 initial set. Static analysis cannot see when an import() runs, so say it explicitly.
// Sizes are raw bytes, like Angular budgets. Transferred (Brotli) size is smaller, see
// references/chunk-size.md. Nested lazy chunks (an import() inside a lazy chunk) are hidden
// unless --all is passed, and are never added to their parent.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const minKb = Number((args.find((a) => a.startsWith('--min-kb=')) ?? '--min-kb=0').split('=')[1]);
const asJson = args.includes('--json');
const showNested = args.includes('--all');
const preloaded = args.filter((a) => a.startsWith('--preloaded=')).map((a) => a.split('=')[1]);

if (!target) {
  console.error('Usage: node route-cost.mjs <stats.json | dist/<project>> [--min-kb=N] [--all] [--preloaded=<text>] [--json]');
  process.exit(2);
}
const file = existsSync(target) && statSync(target).isDirectory() ? join(target, 'stats.json') : target;
if (!existsSync(file)) {
  console.error(`No stats file at ${file}. Build with statsJson enabled. A failed build writes none (references/build-and-deploy.md).`);
  process.exit(2);
}

const raw = JSON.parse(readFileSync(file, 'utf8')).outputs;
// Browser bundle only: SSR builds put server output (.mjs) in the same metafile.
const outputs = Object.fromEntries(Object.entries(raw).filter(([n]) => n.endsWith('.js') || n.endsWith('.css')));
// kB is 1000 bytes, as in the Angular build table. KiB is 1024, as in budget strings like "500kB".
const kb = (n) => (n / 1000).toFixed(1);
const kib = (n) => (n / 1024).toFixed(1);

const names = Object.keys(outputs);
const staticImports = (name) => (outputs[name]?.imports ?? []).filter((i) => i.kind === 'import-statement' && outputs[i.path]).map((i) => i.path);
const dynamicImports = (name) => (outputs[name]?.imports ?? []).filter((i) => i.kind === 'dynamic-import' && outputs[i.path]).map((i) => i.path);

function closure(roots, exclude = new Set()) {
  const seen = new Set();
  const stack = [...roots];
  while (stack.length) {
    const n = stack.pop();
    if (seen.has(n) || exclude.has(n)) continue;
    seen.add(n);
    stack.push(...staticImports(n));
  }
  return seen;
}
const total = (set) => [...set].reduce((s, n) => s + (outputs[n]?.bytes ?? 0), 0);

const dynamicTargets = new Set(names.flatMap(dynamicImports));
const initialRoots = names.filter((n) => outputs[n].entryPoint && !dynamicTargets.has(n));
const initial = closure(initialRoots);
const initialBytes = total(initial);
const startup = names.filter((n) => dynamicTargets.has(n) && preloaded.some((p) => n.includes(p) || (outputs[n].entryPoint ?? '').includes(p)));
for (const n of closure(startup)) initial.add(n);
const startupBytes = total(initial) - initialBytes;

// Top-level lazy chunks: imported dynamically from a file in the initial set. --all adds nested ones.
const topLevel = new Set([...initial].flatMap(dynamicImports));
const rows = [...dynamicTargets]
  .filter((n) => !initial.has(n) && (showNested || topLevel.has(n)))
  .map((n) => {
    const own = outputs[n].bytes;
    const extra = closure([n], initial);
    extra.delete(n);
    return {
      chunk: n,
      source: outputs[n].entryPoint ?? Object.keys(outputs[n].inputs ?? {}).sort((a, b) => outputs[n].inputs[b].bytesInOutput - outputs[n].inputs[a].bytesInOutput)[0] ?? '(unknown)',
      ownBytes: own,
      sharedBytes: total(extra),
      totalBytes: own + total(extra),
      sharedChunks: extra.size,
    };
  })
  .filter((r) => r.totalBytes >= minKb * 1024)
  .sort((a, b) => b.totalBytes - a.totalBytes);

if (asJson) {
  console.log(JSON.stringify({ initialBytes, startupBytes, initialEntries: initialRoots, routes: rows }, null, 2));
  process.exit(0);
}

console.log(`Initial (raw): ${kb(initialBytes)} kB (${kib(initialBytes)} KiB), entries: ${initialRoots.join(', ')}`);
if (startupBytes) console.log(`Startup import() chunks treated as loaded (--preloaded): +${kb(startupBytes)} kB (${kib(startupBytes)} KiB), not in the initial figure above`);
console.log(`Lazy chunks: ${rows.length}${minKb ? ` at or above ${minKb} kB` : ''}. Route cost = own + static closure not already in initial.`);
console.log('');
console.log('route cost kB (KiB) | own | extra shared (files) | chunk | source');
for (const r of rows) {
  console.log(`${kb(r.totalBytes).padStart(7)} (${kib(r.totalBytes).padStart(6)}) | ${kb(r.ownBytes).padStart(7)} | ${kb(r.sharedBytes).padStart(7)} (${r.sharedChunks}) | ${r.chunk} | ${r.source}`);
}
console.log('');
console.log('The source column is the metafile entryPoint, or the largest input when absent. Nested lazy chunks (import() inside a lazy chunk) need --all.');
