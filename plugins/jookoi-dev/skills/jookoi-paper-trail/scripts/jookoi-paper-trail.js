#!/usr/bin/env node
// jookoi-paper-trail — working-set store and context-file mechanics.
// Design: _architecture/plans/2026-09-24-remove-todo-md-route-by-information-type.md
// Spec:   ../references/store-format.md, ../references/file-formats.md
//
// Usage:
//   jookoi-paper-trail list [--status=S] [--since=DATE] [--stale=DAYS]   default: now items + 3 latest done
//   jookoi-paper-trail list --archived [--last N]           flushed items, newest first (default 10)
//   jookoi-paper-trail find "<text>"                        every status plus the archive
//   jookoi-paper-trail show <id>                            resolves archived ids too
//   jookoi-paper-trail count                                counts per status, last flush
//   jookoi-paper-trail render [--status=S]                  store as markdown, ids carry the repo prefix
//   jookoi-paper-trail add --title "<t>" | - | --file F     payload: YAML/JSON {title, body, status, priority, after, before, first, last}
//   jookoi-paper-trail done|park|start|drop <id>
//   jookoi-paper-trail edit <id> --title "<t>" | - | --file F   payload keys given replace the item's
//   jookoi-paper-trail move <id> <placement>                placement: --after=ID --before=ID --first --last
//   jookoi-paper-trail flush [--before=DATE]                done+dropped -> archive/items-YYYY-MM.yaml
//   jookoi-paper-trail stale [DAYS]                         stale now items, plus CONTEXT.md files behind their folder
//   jookoi-paper-trail check                                validate the store and managed files
//   jookoi-paper-trail sweep [--gate] [--ack]               uncommitted work vs the store and context files
//   jookoi-paper-trail hooks [--print [--harness=H]]        which hooks are wired; --print: fragment for this install
//   jookoi-paper-trail new-decision "<title>"               next NNN in plans/decision-history/, listed in index.md
//   jookoi-paper-trail new-plan "<topic>"                   dated plan file from template
//
// Global flags: --private (operate on _jookoi-architecture/), --root <path>, --dry-run
//
// This script is the only writer of items.yaml. Judgement (what happened, where it
// belongs) stays with the model.

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");
const yaml = require("./vendor/js-yaml.cjs.js");
const registry = require("./registry.js");

const TEMPLATES = path.join(__dirname, "..", "assets", "templates");
const STATUSES = ["now", "parked", "done", "dropped"];
const STEP = 1000;
// Dump with the schema load uses, and never fold long lines.
const YAML_OPTS = { schema: yaml.CORE_SCHEMA, lineWidth: -1, noRefs: true };
// Starts with a letter and holds a digit, so YAML never reads an id as a number, boolean or null.
const INDEX_PLACEHOLDER = "one line on what it explains.";
const ID_RE =/^[a-z][a-z0-9]*[0-9][a-z0-9]*$/;

class Refusal extends Error {}
function refuse(where, detail) {
  throw new Refusal(`${where}: ${detail}`);
}

// ---------------------------------------------------------------- environment

function repoRoot(explicit) {
  if (explicit) return path.resolve(explicit);
  try {
    return execSync("git rev-parse --show-toplevel", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    let dir = process.cwd();
    for (;;) {
      if (fs.existsSync(path.join(dir, "_architecture")) || fs.existsSync(path.join(dir, "_jookoi-architecture"))) return dir;
      const up = path.dirname(dir);
      if (up === dir) return process.cwd();
      dir = up;
    }
  }
}

function archDir(root, priv) {
  return path.join(root, priv ? "_jookoi-architecture" : "_architecture");
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Full timestamp for items.yaml's ts_* fields. ISO 8601, UTC, seconds precision.
function nowISO() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

// Timestamp for prose MD content (Date:, Session:, updated:). European order, local time.
function nowEuro() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// "DD-MM-YYYY HH:MM" -> "YYYY-MM-DD", for comparing against git's --date=short output.
function euroToISODate(s) {
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// Repo-relative path with forward slashes, the same on Windows and Unix.
function rel(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

// Templates are normalized to LF so generated files do not depend on the checkout's line endings.
function template(name) {
  return fs.readFileSync(path.join(TEMPLATES, name), "utf8").replace(/\r\n/g, "\n");
}

// ---------------------------------------------------------------------- store

// Default repo prefix: the root folder's leaf name. Written once when the file is
// created and never derived again, so a clone in a differently named folder keeps it.
function repoName(root) {
  return path.basename(root).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "repo";
}

function emptyStore(ctx) {
  return { repo: repoName(ctx.root), last_flush: null, items: {} };
}

function parseYaml(file, text) {
  try {
    return yaml.load(text, { schema: yaml.CORE_SCHEMA });
  } catch (e) {
    refuse(file, `not valid YAML (${e.message.split("\n")[0]}) -- fix by hand`);
  }
}

function checkItem(file, id, it) {
  if (!ID_RE.test(id)) refuse(file, `${id}: ids start with a letter and contain a digit`);
  if (!it || typeof it !== "object") refuse(file, `${id}: not a mapping`);
  if (!STATUSES.includes(it.status)) refuse(file, `${id}: status ${JSON.stringify(it.status)} outside ${STATUSES.join(" | ")}`);
  if (typeof it.title !== "string" || !it.title.trim() || it.title.includes("\n")) refuse(file, `${id}: title must be a non-empty single line`);
  if (it.body !== undefined && it.body !== null && typeof it.body !== "string") refuse(file, `${id}: body must be a string`);
  if (typeof it.priority !== "number") refuse(file, `${id}: priority must be a number`);
}

function loadStore(ctx) {
  const file = path.join(ctx.arch, "items.yaml");
  if (!fs.existsSync(file)) return { file, raw: null, store: emptyStore(ctx) };
  const raw = fs.readFileSync(file, "utf8");
  const store = parseYaml(file, raw);
  if (!store || typeof store !== "object" || !store.items || typeof store.items !== "object" || typeof store.repo !== "string") {
    refuse(file, "expected a mapping with repo: and items:");
  }
  for (const [id, it] of Object.entries(store.items)) checkItem(file, id, it);
  return { file, raw, store };
}

// Read-modify-write with a compare against what was read; a mismatch means a
// concurrent writer (terminal vs. agent) and is refused rather than merged.
function assertUnchanged(loaded) {
  const current = fs.existsSync(loaded.file) ? fs.readFileSync(loaded.file, "utf8") : null;
  if (current !== loaded.raw) refuse(loaded.file, "changed on disk while this command ran -- re-run it");
}

function saveStore(ctx, loaded) {
  assertUnchanged(loaded);
  ctx.write(loaded.file, yaml.dump(loaded.store, YAML_OPTS));
}

function archiveFiles(ctx) {
  const dir = path.join(ctx.arch, "archive");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^items-\d{4}-\d{2}\.yaml$/.test(f)).sort().map((f) => path.join(dir, f));
}

function loadArchive(file) {
  const arch = parseYaml(file, fs.readFileSync(file, "utf8"));
  if (!arch || !arch.items || typeof arch.items !== "object") refuse(file, "expected a mapping with items:");
  for (const [id, it] of Object.entries(arch.items)) checkItem(file, id, it);
  return arch;
}

function archivedEntries(ctx) {
  const out = [];
  archiveFiles(ctx).forEach((f) => Object.entries(loadArchive(f).items).forEach(([id, it]) => out.push([id, it, f])));
  return out;
}

// Accepts `k4f9`, `repo:k4f9`, and the legacy `t017` / `t17` forms.
function normalizeId(store, input) {
  let s = String(input || "").trim().toLowerCase();
  const colon = s.indexOf(":");
  if (colon !== -1) {
    const prefix = s.slice(0, colon);
    if (prefix !== store.repo) refuse("id", `${JSON.stringify(input)} belongs to repo "${prefix}", this repo is "${store.repo}"`);
    s = s.slice(colon + 1);
  }
  const legacy = s.match(/^t(\d+)$|^(\d+)$/);
  if (legacy) return "t" + (legacy[1] || legacy[2]).padStart(3, "0");
  return ID_RE.test(s) ? s : null;
}

// Active items resolve always. Archived items resolve only for read commands.
function getItem(ctx, store, input, { archived = false } = {}) {
  const id = normalizeId(store, input);
  if (!id) refuse("id", `${JSON.stringify(input)} is not an item id (expected e.g. k4f9)`);
  if (store.items[id]) return { id, item: store.items[id] };
  const hit = archivedEntries(ctx).find(([aid]) => aid === id);
  if (hit && archived) return { id, item: hit[1], file: hit[2] };
  if (hit) refuse("id", `${label(id, hit[1])} is flushed to ${path.basename(hit[2])} and read-only -- use show or find`);
  refuse("id", `${id} does not exist`);
}

// Random base36, no counter. Collision-checked against the active file and every archive file.
function newId(ctx, store) {
  const taken = new Set(Object.keys(store.items));
  archivedEntries(ctx).forEach(([id]) => taken.add(id));
  for (;;) {
    const id = crypto.randomBytes(4).readUInt32BE(0).toString(36).padStart(4, "a").slice(-4);
    if (ID_RE.test(id) && !taken.has(id)) return id;
  }
}

function byPriority(a, b) {
  return a[1].priority - b[1].priority || a[0].localeCompare(b[0]);
}

// Every user-facing mention of an item is `id title`, never a bare id.
function label(id, item) {
  return `${id} ${item.title}`;
}

function line(id, item) {
  const box = item.status === "done" ? "[x]" : item.status === "dropped" ? "[-]" : "[ ]";
  return `- ${box} ${label(id, item)}`;
}

function cleanBody(s) {
  return String(s == null ? "" : s).replace(/\r\n/g, "\n").replace(/^\n+|\n+$/g, "");
}

// Payload for add/edit: `-` (stdin) or --file carry YAML (JSON is valid YAML). --title alone is a title-only item.
function readPayload(args, opts) {
  let text = null;
  if (args[0] === "-") text = fs.readFileSync(0, "utf8");
  else if (opts.file) {
    const file = path.resolve(opts.file);
    if (!fs.existsSync(file)) refuse("--file", `${file} does not exist`);
    text = fs.readFileSync(file, "utf8");
  }
  let p = {};
  if (text !== null) {
    p = parseYaml("payload", text);
    if (!p || typeof p !== "object" || Array.isArray(p)) refuse("payload", "expected a YAML mapping with title, body, status, priority");
  }
  const allowed = ["title", "body", "status", "priority", "after", "before", "first", "last"];
  Object.keys(p).forEach((k) => { if (!allowed.includes(k)) refuse("payload", `unknown key ${k} (allowed: ${allowed.join(", ")})`); });
  if (opts.title !== undefined) p.title = opts.title;
  if (p.title !== undefined) {
    p.title = String(p.title).trim();
    if (!p.title || p.title.includes("\n")) refuse("title", "must be a non-empty single line");
  }
  if (p.body !== undefined) p.body = cleanBody(p.body);
  return p;
}

// Placement computes a priority from a neighbour the caller already saw in `list`.
function placement(ctx, store, opts, excludeId) {
  const others = Object.entries(store.items).filter(([id]) => id !== excludeId).sort(byPriority);
  if (opts.priority !== undefined) {
    const n = Number(opts.priority);
    if (!Number.isFinite(n)) refuse("--priority", "must be a number");
    return n;
  }
  if (opts.first) return others.length ? others[0][1].priority - STEP : STEP;
  const ref = opts.after !== undefined ? ["after", opts.after] : opts.before !== undefined ? ["before", opts.before] : null;
  if (ref) {
    const { id } = getItem(ctx, store, ref[1]);
    const i = others.findIndex(([oid]) => oid === id);
    if (i === -1) refuse("placement", `cannot place ${excludeId} relative to itself`);
    const p = others[i][1].priority;
    if (ref[0] === "after") return i === others.length - 1 ? p + STEP : (p + others[i + 1][1].priority) / 2;
    return i === 0 ? p - STEP : (others[i - 1][1].priority + p) / 2;
  }
  return others.length ? others[others.length - 1][1].priority + STEP : STEP;
}

// ------------------------------------------------------------- store commands

function byDoneDesc(a, b) {
  return (b[1].ts_done || "").localeCompare(a[1].ts_done || "") || b[0].localeCompare(a[0]);
}

function cmdList(ctx, _args, opts) {
  if (opts.archived) {
    const n = opts.last === undefined ? 10 : Number(opts.last);
    if (!Number.isInteger(n) || n < 1) refuse("--last", "needs a positive whole number");
    const picked = archivedEntries(ctx).sort(byDoneDesc).slice(0, n);
    if (!picked.length) return ctx.report("(none)");
    return picked.forEach(([id, it, f]) => ctx.report(`${line(id, it)}  (${path.basename(f)})`));
  }
  const { store } = loadStore(ctx);
  const entries = Object.entries(store.items).sort(byPriority);
  let picked;

  if (opts.stale !== undefined) {
    const days = Number(opts.stale);
    if (!Number.isFinite(days)) refuse("--stale", "needs a number of days");
    picked = entries.filter(([, it]) => it.status === "now" && daysBetween(it.ts_touched, today()) >= days);
  } else if (opts.status) {
    if (!STATUSES.includes(opts.status)) refuse("--status", `${opts.status} is outside ${STATUSES.join(" | ")}`);
    picked = entries.filter(([, it]) => it.status === opts.status);
    if (opts.since) picked = picked.filter(([, it]) => (it.ts_done || it.ts_touched || "") >= opts.since);
    if (opts.status === "done") picked.sort(byDoneDesc);
  } else {
    const now = entries.filter(([, it]) => it.status === "now");
    const done = entries.filter(([, it]) => it.status === "done").sort(byDoneDesc).slice(0, 3);
    picked = now.concat(done);
  }
  if (!picked.length) return ctx.report("(none)");
  picked.forEach(([id, it]) => ctx.report(line(id, it) + (!it.body && (it.status === "now" || it.status === "parked") ? "  (no body)" : "")));
}

function daysBetween(from, to) {
  if (!from) return Infinity;
  return Math.floor((Date.parse(to) - Date.parse(from)) / 86400000);
}

function matches(it, needle) {
  return `${it.title}\n${it.body || ""}`.toLowerCase().includes(needle);
}

function cmdFind(ctx, [text]) {
  if (!text) refuse("find", "needs a search string");
  const needle = text.toLowerCase();
  const { store } = loadStore(ctx);
  let hits = 0;
  Object.entries(store.items).sort(byPriority).forEach(([id, it]) => {
    if (matches(it, needle)) { ctx.report(`${line(id, it)}  (${it.status})`); hits++; }
  });
  archivedEntries(ctx).forEach(([id, it, f]) => {
    if (matches(it, needle)) { ctx.report(`${line(id, it)}  (archived: ${path.basename(f)})`); hits++; }
  });
  const legacy = path.join(ctx.arch, "archive");
  if (fs.existsSync(legacy)) {
    fs.readdirSync(legacy).filter((f) => /^\d{4}-\d{2}\.md$/.test(f)).forEach((f) => {
      fs.readFileSync(path.join(legacy, f), "utf8").split("\n").forEach((l, i) => {
        if (l.toLowerCase().includes(needle)) { ctx.report(`archive/${f}:${i + 1}: ${l.trim().slice(0, 140)}`); hits++; }
      });
    });
  }
  if (!hits) ctx.report("(no matches)");
}

function cmdShow(ctx, [id]) {
  const { store } = loadStore(ctx);
  const found = getItem(ctx, store, id, { archived: true });
  const it = found.item;
  ctx.report(`${label(found.id, it)}`);
  ctx.report(`${it.status}${found.file ? ` (archived: ${path.basename(found.file)})` : ""}  created ${it.ts_created || "?"}  started ${it.ts_started || "-"}  done ${it.ts_done || "-"}  touched ${it.ts_touched || "?"}`);
  if (it.body) { ctx.report(""); ctx.report(it.body); }
}

function cmdCount(ctx) {
  const { store } = loadStore(ctx);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  Object.values(store.items).forEach((it) => counts[it.status]++);
  ctx.report(STATUSES.map((s) => `${s} ${counts[s]}`).join("  "));
  ctx.report(`archived ${archivedEntries(ctx).length}  last flush ${store.last_flush || "never"}`);
}

function cmdRender(ctx, _args, opts) {
  const { store } = loadStore(ctx);
  const wanted = opts.status ? [opts.status] : STATUSES;
  wanted.forEach((s) => { if (!STATUSES.includes(s)) refuse("--status", `${s} is outside ${STATUSES.join(" | ")}`); });
  const out = [];
  wanted.forEach((s) => {
    const entries = Object.entries(store.items).filter(([, it]) => it.status === s).sort(byPriority);
    if (!entries.length) return;
    out.push(`## ${s}`, "");
    entries.forEach(([id, it]) => {
      out.push(`### ${store.repo}:${label(id, it)}`, "");
      if (it.body) out.push(it.body, "");
    });
  });
  ctx.report(out.length ? out.join("\n").replace(/\n+$/, "") : "(empty)");
}

function cmdAdd(ctx, args, opts) {
  const p = readPayload(args, opts);
  if (!p.title) refuse("add", "needs a title: --title \"...\", or a payload on stdin (-) or --file with a title key");
  const status = p.status || opts.status || "now";
  if (status !== "now" && status !== "parked") refuse("add", "status must be now or parked");
  const loaded = loadStore(ctx);
  const { store } = loaded;
  const id = newId(ctx, store);
  const d = nowISO();
  store.items[id] = {
    title: p.title,
    status,
    priority: placement(ctx, store, { ...p, ...opts }, id),
    body: p.body || "",
    ts_created: d,
    ts_started: status === "now" ? d : null,
    ts_done: null,
    ts_touched: d,
  };
  saveStore(ctx, loaded);
  ctx.report(`${label(id, store.items[id])} added (${status})`);
  bodyNotes(ctx, store, id, store.items[id]);
}

// Nudges, not refusals: an item is a scratchpad, and a title alone rarely carries
// enough for a cold session to act on it.
function bodyNotes(ctx, store, id, item) {
  if (!item.body) {
    ctx.report(`note: ${id} has no body. Keep it title-only only if the title says everything. Otherwise: edit ${id} --file F with context, current state, next step, and pointers to files, plans or decisions.`);
    return;
  }
  const bare = Object.entries(store.items)
    .filter(([oid, o]) => oid !== id && new RegExp(`\\b${oid}\\b`).test(item.body) && !item.body.includes(`${oid} ${o.title}`))
    .map(([oid, o]) => label(oid, o));
  if (bare.length) ctx.report(`note: the body names items by bare id. Write them as id plus title: ${bare.join("; ")}`);
}

function cmdTransition(target) {
  return (ctx, [id]) => {
    const loaded = loadStore(ctx);
    const { id: realId, item } = getItem(ctx, loaded.store, id);
    const d = nowISO();
    item.status = target;
    item.ts_touched = d;
    item.ts_done = target === "done" ? d : null;
    if (target === "now" && !item.ts_started) item.ts_started = d;
    saveStore(ctx, loaded);
    ctx.report(`${label(realId, item)} -> ${target}`);
  };
}

function cmdEdit(ctx, [id, ...rest], opts) {
  if (!id) refuse("edit", "needs <id> and a payload: --title, or - / --file");
  const p = readPayload(rest, opts);
  if (p.title === undefined && p.body === undefined) refuse("edit", "payload has neither title nor body");
  const loaded = loadStore(ctx);
  const { id: realId, item } = getItem(ctx, loaded.store, id);
  if (p.title !== undefined) item.title = p.title;
  if (p.body !== undefined) item.body = p.body;
  item.ts_touched = nowISO();
  saveStore(ctx, loaded);
  ctx.report(`${label(realId, item)} edited`);
  bodyNotes(ctx, loaded.store, realId, item);
}

function cmdMove(ctx, [id], opts) {
  const loaded = loadStore(ctx);
  const { id: realId, item } = getItem(ctx, loaded.store, id);
  if (!["after", "before", "first", "last", "priority"].some((k) => opts[k] !== undefined)) {
    refuse("move", "needs a placement: --after=<id> | --before=<id> | --first | --last");
  }
  item.priority = placement(ctx, loaded.store, opts, realId);
  item.ts_touched = nowISO();
  saveStore(ctx, loaded);
  ctx.report(`${label(realId, item)} moved`);
}

// Moves done and dropped items out of the live store into archive/items-YYYY-MM.yaml,
// one file per month of ts_done. Nothing else is touched.
function cmdFlush(ctx, _args, opts) {
  const loaded = loadStore(ctx);
  const { store } = loaded;
  const before = opts.before;
  const moving = Object.entries(store.items).filter(([, it]) =>
    (it.status === "done" || it.status === "dropped") && (!before || (it.ts_done || it.ts_touched || "") < before)
  );
  if (!moving.length) return ctx.report("nothing to flush");

  const archived = new Set(archivedEntries(ctx).map(([id]) => id));
  moving.forEach(([id, it]) => { if (archived.has(id)) refuse("flush", `${label(id, it)} already exists in an archive file -- ids must never collide`); });

  const byMonth = {};
  moving.forEach(([id, it]) => {
    const month = (it.ts_done || it.ts_touched || nowISO()).slice(0, 7);
    (byMonth[month] = byMonth[month] || []).push([id, it]);
  });
  assertUnchanged(loaded); // before any archive file is written, so a refusal leaves nothing duplicated
  const written = [];
  Object.entries(byMonth).sort().forEach(([month, group]) => {
    const file = path.join(ctx.arch, "archive", `items-${month}.yaml`);
    const arch = fs.existsSync(file) ? loadArchive(file) : { items: {} };
    group.forEach(([id, it]) => { arch.items[id] = it; });
    ctx.write(file, yaml.dump(arch, YAML_OPTS));
    written.push(`archive/items-${month}.yaml`);
  });
  moving.forEach(([id]) => delete store.items[id]);
  store.last_flush = nowISO();
  saveStore(ctx, loaded);
  ctx.report(`flushed ${moving.length} item${moving.length === 1 ? "" : "s"} into ${written.join(", ")}:`);
  moving.forEach(([id, it]) => ctx.report(line(id, it)));
}

// ---------------------------------------------------------- stale / check / new

function cmdStale(ctx, [days]) {
  const limit = days === undefined ? 14 : Number(days);
  if (!Number.isFinite(limit)) refuse("stale", "days must be a number");
  const { store } = loadStore(ctx);
  const stale = Object.entries(store.items)
    .filter(([, it]) => it.status === "now" && daysBetween(it.ts_touched, today()) >= limit)
    .sort(byPriority);
  ctx.report(stale.length ? `now items untouched for ${limit}+ days:` : `no now items untouched for ${limit}+ days`);
  stale.forEach(([id, it]) => ctx.report(line(id, it)));

  let out = [];
  try {
    out = execSync("git ls-files -z", { cwd: ctx.root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\0");
  } catch { ctx.report("context files: skipped (not a git repository)"); return; }
  // Templates carry a placeholder `updated:` and would be flagged forever.
  const contexts = out.filter((f) => /(^|\/)(_jookoi-)?CONTEXT\.md$/.test(f) && !/(^|\/)assets\/templates\//.test(f));
  let flagged = 0;
  let checked = 0;
  contexts.forEach((rel) => {
    const abs = path.join(ctx.root, rel);
    if (!fs.existsSync(abs)) return;
    checked++;
    const m = fs.readFileSync(abs, "utf8").match(/^updated:\s*(\d{2}-\d{2}-\d{4})[^\n]*/m);
    if (!m) { ctx.report(`${rel}  NO updated: LINE`); flagged++; return; }
    const updatedISO = euroToISODate(m[1]);
    let committed;
    try {
      committed = execSync(`git log -1 --format=%cd --date=short -- "${path.dirname(rel)}"`, { cwd: ctx.root, encoding: "utf8" }).trim();
    } catch { return; }
    if (committed && updatedISO && committed > updatedISO) { ctx.report(`${rel}  updated ${m[1]}, folder committed ${committed}  LIKELY STALE`); flagged++; }
  });
  ctx.report(contexts.length ? (flagged ? `context files: ${flagged} of ${checked} flagged` : `context files: ${checked} checked, none stale`) : "context files: none found");
}

// ------------------------------------------------------------ hooks and sweep

// Where each harness keeps hook registrations, and the three hook scripts to look for.
function hookFiles(root) {
  const home = os.homedir();
  return {
    "Claude Code": [
      path.join(home, ".claude", "settings.json"), path.join(home, ".claude", "settings.local.json"),
      path.join(root, ".claude", "settings.json"), path.join(root, ".claude", "settings.local.json"),
    ],
    "Gemini CLI": [
      path.join(home, ".gemini", "settings.json"), path.join(home, ".gemini", "hooks", "hooks.json"),
      path.join(root, ".gemini", "settings.json"), path.join(root, ".gemini", "hooks", "hooks.json"),
    ],
    "Copilot CLI": [path.join(root, "hooks.json"), path.join(root, ".github", "hooks", "hooks.json")],
  };
}

const HOOK_SCRIPTS = { gate: "doc-gate.sh", rehydrate: "rehydrate.sh", preserve: "preserve.sh" };

// Harnesses with hook support, the fragment for each, and where it merges.
const HARNESSES = {
  claude: { name: "Claude Code", config: "claude-code.json", target: "~/.claude/settings.json" },
  gemini: { name: "Gemini CLI", config: "gemini.json", target: ".gemini/hooks/hooks.json (Gemini CLI v0.26.0+)" },
  copilot: { name: "Copilot CLI", config: "copilot.json", target: "the repo's hooks.json" },
};

// Only harnesses that mark their shells are detected. Anything else is null: no
// hooks are assumed, and the model is the gate. JOOKOI_HARNESS overrides.
function detectHarness() {
  const forced = process.env.JOOKOI_HARNESS;
  if (forced) return HARNESSES[forced] ? forced : null;
  if (process.env.CLAUDECODE) return "claude";
  if (process.env.GEMINI_CLI) return "gemini";
  return null;
}

const NO_HOOKS = "No hook-capable harness detected (hooks exist for Claude Code, Gemini CLI and Copilot CLI; JOOKOI_HARNESS=claude|gemini|copilot overrides detection). Nothing checks this session for you: run `list` at session start and `sweep` before ending any turn that changed files.";

function hooksStatus(root) {
  return Object.entries(hookFiles(root)).map(([harness, files]) => {
    const found = {};
    files.filter((f) => fs.existsSync(f)).forEach((f) => {
      const text = fs.readFileSync(f, "utf8");
      Object.entries(HOOK_SCRIPTS).forEach(([job, script]) => { if (text.includes(script)) found[job] = f; });
    });
    return { harness, found };
  });
}

// The hook commands for wherever this copy of the skill is installed (~/.agents,
// a plugin cache, a repo), with forward slashes so sh on Windows accepts them.
function hookCommand(script) {
  const dir = path.resolve(__dirname, "..", "hooks").replace(/\\/g, "/");
  const home = os.homedir().replace(/\\/g, "/");
  const shown = dir.toLowerCase().startsWith(home.toLowerCase() + "/") ? "$HOME" + dir.slice(home.length) : dir;
  return `sh "${shown}/${script}"`;
}

function missingHooksMessage(key) {
  const h = HARNESSES[key];
  return `${h.name} hooks are missing: nothing lists the working set at session start or checks at the end of a turn. Tell the user once, and offer to merge the output of \`hooks --print\` (paths already point at this install) into ${h.target}, adding to existing entries, with their approval. Until then, run \`sweep\` before ending any turn that changed files. Details: references/hooks.md.`;
}

function cmdHooks(ctx, _args, opts) {
  const home = os.homedir();
  const current = detectHarness();
  if (opts.print) {
    const key = opts.harness || current;
    if (!key || !HARNESSES[key]) refuse("hooks --print", `needs --harness=${Object.keys(HARNESSES).join("|")} (no hook-capable harness detected)`);
    const frag = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "hooks", "config", HARNESSES[key].config), "utf8"));
    Object.keys(frag).filter((k) => k.startsWith("//")).forEach((k) => delete frag[k]);
    Object.values(frag.hooks).forEach((arr) => arr.forEach((m) => m.hooks.forEach((h) => { h.command = hookCommand(h.command.match(/([a-z-]+\.sh)/)[1]); })));
    ctx.report(`// ${HARNESSES[key].name}: merge into ${HARNESSES[key].target}`);
    return ctx.report(JSON.stringify(frag, null, 2));
  }
  const status = hooksStatus(ctx.root);
  status.forEach(({ harness, found }) => {
    const jobs = Object.keys(HOOK_SCRIPTS).map((j) => `${j} ${found[j] ? `yes (${found[j].replace(home, "~")})` : "no"}`);
    const mark = current && HARNESSES[current].name === harness ? "  <- this session" : "";
    ctx.report(`${harness}: ${jobs.join(", ")}${mark}`);
  });
  if (!current) return ctx.report(NO_HOOKS);
  const found = status.find((h) => h.harness === HARNESSES[current].name).found;
  if (!found.gate || !found.rehydrate) ctx.report(missingHooksMessage(current));
}

function mtime(file) {
  try { return fs.statSync(file).mtimeMs; } catch { return 0; }
}

function ackFile(root) {
  const key = process.platform === "win32" ? path.resolve(root).toLowerCase() : path.resolve(root);
  return path.join(os.homedir(), ".jookoi-paper-trail", "ack", crypto.createHash("sha1").update(key).digest("hex").slice(0, 16));
}

// Docs and the store itself are the record, not the work being recorded.
const RECORD_RE = /^(_architecture|_jookoi-architecture)\/|(^|\/)(_jookoi-)?CONTEXT\.md$|(^|\/)(AGENTS|CLAUDE)\.md$/;

function hhmm(ms) {
  if (!ms) return "never";
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Compares uncommitted work against the working set and the context files. Mechanical
// only: it says what might be unrecorded; deciding what to write is the model's job.
function cmdSweep(ctx, _args, opts) {
  const ack = ackFile(ctx.root);
  if (opts.ack) {
    if (!ctx.dryRun) { fs.mkdirSync(path.dirname(ack), { recursive: true }); fs.writeFileSync(ack, new Date().toISOString() + "\n"); }
    return ctx.report("acknowledged: nothing to record for the changes so far. The gate stays quiet until files change again.");
  }

  let porcelain;
  try {
    porcelain = execSync("git status --porcelain -z --untracked-files=all", { cwd: ctx.root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch { if (!opts.gate) ctx.report("sweep: skipped (not a git repository)"); return; }
  const changed = porcelain.split("\0").filter(Boolean)
    .map((e) => e.slice(3).replace(/\\/g, "/"))
    .filter((p) => !RECORD_RE.test(p) && fs.existsSync(path.join(ctx.root, p)) && fs.statSync(path.join(ctx.root, p)).isFile());
  const newest = Math.max(0, ...changed.map((p) => mtime(path.join(ctx.root, p))));
  const storeWrite = Math.max(mtime(path.join(ctx.root, "_architecture", "items.yaml")), mtime(path.join(ctx.root, "_jookoi-architecture", "items.yaml")));
  const recorded = Math.max(storeWrite, mtime(ack));

  if (opts.gate) {
    const quietMs = Number(process.env.JOOKOI_GATE_QUIET_MIN || 10) * 60000;
    if (!changed.length || newest <= recorded || Date.now() - recorded < quietMs) return;
  }

  const findings = [];
  const unrecorded = changed.filter((p) => mtime(path.join(ctx.root, p)) > recorded);
  if (unrecorded.length) findings.push(`${unrecorded.length} changed file${unrecorded.length === 1 ? "" : "s"} newer than the last working-set write (${hhmm(storeWrite)}): ${unrecorded.slice(0, 8).join(", ")}${unrecorded.length > 8 ? ", ..." : ""}`);

  const stale = new Map();
  const bare = new Set();
  changed.forEach((p) => {
    const t = mtime(path.join(ctx.root, p));
    let dir = path.posix.dirname(p);
    for (;;) {
      const hit = ["CONTEXT.md", "_jookoi-CONTEXT.md"].map((n) => (dir === "." ? n : `${dir}/${n}`)).find((c) => fs.existsSync(path.join(ctx.root, c)));
      // Templates carry placeholder content and are never "stale".
      if (hit && !/(^|\/)assets\/templates\//.test(hit)) { if (mtime(path.join(ctx.root, hit)) < t) stale.set(hit, (stale.get(hit) || 0) + 1); return; }
      if (hit) return;
      if (dir === ".") { const top = path.posix.dirname(p); if (top !== "." && t > recorded) bare.add(top.split("/").slice(0, 2).join("/")); return; }
      dir = path.posix.dirname(dir);
    }
  });
  stale.forEach((n, f) => findings.push(`${f} is older than ${n} change${n === 1 ? "" : "s"} under it: still true?`));
  // Informational only, so it stays out of the gate's block message.
  if (bare.size && !opts.gate) findings.push(`changed folders with no CONTEXT.md: ${[...bare].slice(0, 6).join(", ")}. Create one only if a newcomer would need context the code does not show.`);

  try {
    const { store } = loadStore(ctx);
    const noBody = Object.entries(store.items).filter(([, it]) => (it.status === "now" || it.status === "parked") && !it.body).sort(byPriority);
    if (noBody.length) findings.push(`items with no body: ${noBody.slice(0, 8).map(([id, it]) => label(id, it)).join("; ")}${noBody.length > 8 ? "; ..." : ""}`);
  } catch (e) { if (e instanceof Refusal) findings.push(e.message); else throw e; }

  // The gate only runs when hooks are wired, so this matters for manual sweeps.
  if (!opts.gate) {
    const current = detectHarness();
    if (!current) findings.push(NO_HOOKS);
    else {
      const found = hooksStatus(ctx.root).find((h) => h.harness === HARNESSES[current].name).found;
      if (!found.gate || !found.rehydrate) findings.push(missingHooksMessage(current));
    }
  }

  if (!findings.length) return ctx.report("sweep: nothing to flag");
  ctx.report("sweep:");
  findings.forEach((f) => ctx.report(`- ${f}`));
  ctx.report("For each: record it (add/edit/done, CONTEXT.md, plan, decision) or, if nothing is worth recording, run `sweep --ack`.");
}

function cmdCheck(ctx) {
  let problems = 0;
  const say = (m) => { problems++; ctx.report(m); };
  const guard = (fn) => { try { fn(); } catch (e) { if (e instanceof Refusal) say(e.message); else throw e; } };

  guard(() => loadStore(ctx));
  archiveFiles(ctx).forEach((f) => guard(() => loadArchive(f)));

  const dDir = path.join(ctx.arch, "plans", "decision-history");
  if (fs.existsSync(dDir)) {
    const required = ["Problem", "Options considered", "Decision", "Why not the alternatives", "Next step"];
    const files = fs.readdirSync(dDir).filter((f) => /^\d{3}-.*\.md$/.test(f));
    files.forEach((f) => {
      const text = fs.readFileSync(path.join(dDir, f), "utf8");
      required.forEach((sec) => {
        if (!new RegExp(`^## ${sec}\\r?$`, "m").test(text)) say(`plans/decision-history/${f}: missing "## ${sec}"`);
      });
    });
    const indexFile = path.join(dDir, "index.md");
    if (!fs.existsSync(indexFile)) { if (files.length) say("plans/decision-history/index.md: missing"); }
    else {
      const indexText = fs.readFileSync(indexFile, "utf8");
      if (indexText.includes(INDEX_PLACEHOLDER)) say("plans/decision-history/index.md: a line still holds the placeholder summary");
      const linked = [...indexText.matchAll(/^- \[[^\]]*\]\(([^)]+\.md)\)/gm)].map((m) => m[1]);
      files.forEach((f) => { if (!linked.includes(f)) say(`plans/decision-history/index.md: no line for ${f}`); });
      linked.forEach((f) => { if (!fs.existsSync(path.join(dDir, f))) say(`plans/decision-history/index.md: line for missing file ${f}`); });
    }
  }
  ctx.report(problems ? `${problems} problem${problems === 1 ? "" : "s"} -- fix by hand; this script will not rewrite them` : "all managed files conform");
}

function cmdNewDecision(ctx, [name]) {
  if (!name) refuse("new-decision", "needs a title");
  const dir = path.join(ctx.arch, "plans", "decision-history");
  const used = fs.existsSync(dir)
    ? fs.readdirSync(dir).map((f) => parseInt((f.match(/^(\d{3})-/) || [])[1], 10)).filter(Number.isInteger)
    : [];
  const n = String((used.length ? Math.max(...used) : 0) + 1).padStart(3, "0");
  const name_ = `${n}-${slugify(name)}.md`;
  const body = template("decision-record.md")
    .replace("# Decision NNN — <Title>", `# Decision ${n} — ${name}`)
    .replace("Date: DD-MM-YYYY HH:MM", `Date: ${nowEuro()}`);
  ctx.write(path.join(dir, name_), body);

  const indexFile = path.join(dir, "index.md");
  const header = "# Decision history\n\nBackground on why rules exist. Not rules. Open a file only when a doc cites it or the user asks why.\n\n";
  const existing = fs.existsSync(indexFile) ? fs.readFileSync(indexFile, "utf8") : header;
  const eol = existing.includes("\r\n") ? "\r\n" : "\n";
  ctx.write(indexFile, `${existing.replace(/(\r?\n)*$/, eol)}- [${n} ${name}](${name_}): ${INDEX_PLACEHOLDER}${eol}`);
  ctx.report(`created plans/decision-history/${name_} and listed it in index.md -- write its one-line summary there`);
}

function cmdNewPlan(ctx, [topic]) {
  if (!topic) refuse("new-plan", "needs a topic");
  const dir = path.join(ctx.arch, "plans");
  const file = path.join(dir, `${today()}-${slugify(topic)}.md`);
  if (fs.existsSync(file)) refuse(file, "already exists");
  const body = template("plan-session.md")
    .replace("# <Title>", `# ${topic}`)
    .replace("Session: DD-MM-YYYY HH:MM.", `Session: ${nowEuro()}.`);
  ctx.write(file, body);
  ctx.report(`created plans/${path.basename(file)}`);
}

// ---------------------------------------------------------------------- main

const COMMANDS = {
  list: cmdList,
  find: cmdFind,
  show: cmdShow,
  count: cmdCount,
  render: cmdRender,
  add: cmdAdd,
  done: cmdTransition("done"),
  park: cmdTransition("parked"),
  start: cmdTransition("now"),
  drop: cmdTransition("dropped"),
  edit: cmdEdit,
  move: cmdMove,
  flush: cmdFlush,
  stale: cmdStale,
  check: cmdCheck,
  sweep: cmdSweep,
  hooks: cmdHooks,
  "new-decision": cmdNewDecision,
  "new-plan": cmdNewPlan,
};

const BOOLEAN_FLAGS = ["private", "dry-run", "first", "archived", "gate", "ack", "print"];

function main(argv) {
  const cmd = argv[0];
  if (!cmd || cmd === "--help" || cmd === "-h" || !COMMANDS[cmd]) {
    const usage = fs.readFileSync(__filename, "utf8").split("\n").slice(4, 24).map((l) => l.replace(/^\/\/ ?/, "")).join("\n");
    console.log(usage);
    process.exit(cmd && !COMMANDS[cmd] ? 1 : 0);
  }

  const opts = {};
  const positional = [];
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-") { positional.push(a); continue; }
    if (!a.startsWith("--")) { positional.push(a); continue; }
    const eq = a.indexOf("=");
    const key = (eq === -1 ? a.slice(2) : a.slice(2, eq));
    const camel = key.replace(/-(\w)/, (_, c) => c.toUpperCase());
    // `--last` is a placement flag for move and a count for `list --archived --last N`.
    const isBool = BOOLEAN_FLAGS.includes(key) || (key === "last" && eq === -1 && cmd !== "list");
    if (isBool) opts[camel] = true;
    else if (eq !== -1) opts[camel] = a.slice(eq + 1);
    else if (i + 1 < argv.length) opts[camel] = argv[++i];
    else { console.error(`Flag needs a value: ${a}`); process.exit(1); }
  }

  const root = repoRoot(opts.root);
  const lines = [];
  const ctx = {
    root,
    arch: archDir(root, opts.private),
    dryRun: opts.dryRun,
    report: (m) => lines.push(m),
    write: (file, content) => {
      if (opts.dryRun) { lines.push(`[dry-run] would write ${rel(root, file)}`); return; }
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    },
  };

  try {
    COMMANDS[cmd](ctx, positional, opts);
    lines.forEach((l) => console.log(l));
    // Remember repos that use the store so the viewer can list them. Best effort, never fatal.
    if (!opts.dryRun && fs.existsSync(path.join(ctx.arch, "items.yaml"))) {
      try { registry.register(root); } catch { /* the registry is a convenience */ }
    }
  } catch (e) {
    if (e instanceof Refusal) {
      console.error(`REFUSED -- ${e.message}`);
      console.error("Nothing was written.");
      process.exit(2);
    }
    throw e;
  }
}

main(process.argv.slice(2));
