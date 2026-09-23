#!/usr/bin/env node
// Per-package breakdown of one output chunk (or the initial set) from an esbuild metafile.
// Zero dependencies, Node 18+, read-only.
// Usage: node chunk-packages.mjs <stats.json | dist/<project>> <chunk-file | entry-substring | initial> [--top=N] [--own]
//   chunk-file       exact output name, e.g. chunk-Cv_QFQXO2.js
//   entry-substring  matches an output entryPoint, e.g. search.page
//   initial          every output that is not a dynamic import() target
// Includes the static-import closure of the picked outputs (--own for the picked files only).
// Sizes are bytesInOutput (raw, pre-compression) grouped by node_modules package, or by
// "src" for application code. Use it to see which package dominates a chunk, for example a UI kit
// component pulling in its datepicker, paginator and scroller.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const [target, what] = args.filter((a) => !a.startsWith('--'));
const top = Number((args.find((a) => a.startsWith('--top=')) ?? '--top=15').split('=')[1]);
if (!target || !what) {
  console.error('Usage: node chunk-packages.mjs <stats.json | dist/<project>> <chunk-file | entry-substring | initial> [--top=N]');
  process.exit(2);
}
const file = existsSync(target) && statSync(target).isDirectory() ? join(target, 'stats.json') : target;
if (!existsSync(file)) {
  console.error(`No stats file at ${file}. A failed build writes none.`);
  process.exit(2);
}

const all = JSON.parse(readFileSync(file, 'utf8')).outputs;
const outputs = Object.fromEntries(Object.entries(all).filter(([n]) => n.endsWith('.js') || n.endsWith('.css')));
const dynamicTargets = new Set(Object.values(outputs).flatMap((o) => (o.imports ?? []).filter((i) => i.kind === 'dynamic-import').map((i) => i.path)));

const roots =
  what === 'initial'
    ? Object.keys(outputs).filter((n) => !dynamicTargets.has(n) && outputs[n].entryPoint)
    : Object.keys(outputs).filter((n) => n === what || (outputs[n].entryPoint ?? '').includes(what));
const picked = [];
for (const stack = [...roots]; stack.length; ) {
  const n = stack.pop();
  if (picked.includes(n)) continue;
  picked.push(n);
  if (!args.includes('--own')) stack.push(...(outputs[n].imports ?? []).filter((i) => i.kind === 'import-statement' && outputs[i.path]).map((i) => i.path));
}
if (!roots.length) {
  console.error(`No output matches "${what}".`);
  process.exit(1);
}

// Package name from a pnpm, npm or yarn path: the last node_modules/ segment wins.
function pkgOf(input) {
  const i = input.lastIndexOf('node_modules/');
  if (i === -1) return 'src';
  const parts = input.slice(i + 'node_modules/'.length).split('/');
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
}

const byPkg = new Map();
let sum = 0;
for (const n of picked) {
  for (const [input, v] of Object.entries(outputs[n].inputs ?? {})) {
    const p = pkgOf(input);
    byPkg.set(p, (byPkg.get(p) ?? 0) + v.bytesInOutput);
    sum += v.bytesInOutput;
  }
}
const kb = (n) => (n / 1000).toFixed(1);
console.log(`${roots.join(', ')} plus ${picked.length - roots.length} static imports: ${kb(sum)} kB of tracked input bytes (file bytes ${kb(picked.reduce((s, n) => s + outputs[n].bytes, 0))} kB)`);
for (const [p, b] of [...byPkg].sort((a, b) => b[1] - a[1]).slice(0, top)) {
  console.log(`${kb(b).padStart(8)} kB  ${((b / sum) * 100).toFixed(0).padStart(3)}%  ${p}`);
}
