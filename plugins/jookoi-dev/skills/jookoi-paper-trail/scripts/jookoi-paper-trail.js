#!/usr/bin/env node
// jookoi-paper-trail — working-set store and context-file mechanics.
// Design: _architecture/plans/2026-09-19-paper-trail-v2-keyed-store-todo-backlog-decisions-decision-l.md
// Spec:   ../references/store-format.md, ../references/file-formats.md
//
// Usage:
//   jookoi-paper-trail list [--status=S] [--since=DATE] [--stale=DAYS]   default: now items + 3 latest done
//   jookoi-paper-trail find "<text>"                        every status plus the archive
//   jookoi-paper-trail show <id>
//   jookoi-paper-trail count                                counts per status, last flush
//   jookoi-paper-trail render [--status=S]                  store as markdown
//   jookoi-paper-trail add "<markdown>" [--status=now|parked] [placement]
//   jookoi-paper-trail done|park|start|drop <id>
//   jookoi-paper-trail edit <id> "<markdown>"
//   jookoi-paper-trail move <id> <placement>                placement: --after=ID --before=ID --first --last
//   jookoi-paper-trail flush [--before=DATE]                done+dropped -> archive/items-YYYY-MM.json
//   jookoi-paper-trail stale [DAYS]                         stale now items, plus CONTEXT.md files behind their folder
//   jookoi-paper-trail check                                validate the store and managed files
//   jookoi-paper-trail new-decision "<title>"               next NNN from template
//   jookoi-paper-trail new-plan "<topic>"                   dated plan file from template
//
// Global flags: --private (operate on _jookoi-architecture/), --root <path>, --dry-run
//
// This script is the only writer of items.json. Judgement (what happened, where it
// belongs, what TODO.md's Context header says) stays with the model.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TEMPLATES = path.join(__dirname, "..", "assets", "templates");
const STATUSES = ["now", "parked", "done", "dropped"];
const STEP = 1000;

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

// Full timestamp for items.json's ts_* fields. ISO 8601, UTC, seconds precision.
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

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function template(name) {
  return fs.readFileSync(path.join(TEMPLATES, name), "utf8");
}

// ---------------------------------------------------------------------- store

function emptyStore() {
  return { next_id: 1, last_flush: null, items: {} };
}

function loadStore(ctx) {
  const file = path.join(ctx.arch, "items.json");
  if (!fs.existsSync(file)) return { file, raw: null, store: emptyStore() };
  const raw = fs.readFileSync(file, "utf8");
  let store;
  try {
    store = JSON.parse(raw);
  } catch (e) {
    refuse(file, `not valid JSON (${e.message}) -- fix by hand`);
  }
  if (!store || typeof store !== "object" || typeof store.items !== "object" || !Number.isInteger(store.next_id)) {
    refuse(file, 'expected {"next_id": <int>, "items": {...}}');
  }
  for (const [id, it] of Object.entries(store.items)) {
    if (!STATUSES.includes(it.status)) refuse(file, `${id}: status ${JSON.stringify(it.status)} outside ${STATUSES.join(" | ")}`);
    if (!Array.isArray(it.content) || !it.content.length) refuse(file, `${id}: content must be a non-empty array of lines`);
    if (typeof it.priority !== "number") refuse(file, `${id}: priority must be a number`);
  }
  return { file, raw, store };
}

// Read-modify-write with a compare against what was read; a mismatch means a
// concurrent writer (terminal vs. agent) and is refused rather than merged.
function saveStore(ctx, loaded) {
  const current = fs.existsSync(loaded.file) ? fs.readFileSync(loaded.file, "utf8") : null;
  if (current !== loaded.raw) refuse(loaded.file, "changed on disk while this command ran -- re-run it");
  ctx.write(loaded.file, JSON.stringify(loaded.store, null, 2) + "\n");
}

function normalizeId(input) {
  const m = String(input || "").match(/^t?(\d+)$/i);
  return m ? "t" + m[1].padStart(3, "0") : null;
}

function getItem(store, input) {
  const id = normalizeId(input);
  if (!id) refuse("id", `${JSON.stringify(input)} is not an item id (expected e.g. t017)`);
  const item = store.items[id];
  if (!item) refuse("id", `${id} does not exist in the store (it may have been flushed to the archive -- try: find)`);
  return { id, item };
}

function byPriority(a, b) {
  return a[1].priority - b[1].priority || a[0].localeCompare(b[0]);
}

function title(item) {
  return item.content[0];
}

function line(id, item) {
  const box = item.status === "done" ? "[x]" : item.status === "dropped" ? "[-]" : "[ ]";
  return `- ${box} \`${id}\` ${title(item)}`;
}

function toLines(markdown) {
  const lines = String(markdown).replace(/\r\n/g, "\n").replace(/^\n+|\n+$/g, "").split("\n");
  if (!lines[0]) refuse("content", "empty -- the first line is the item title");
  return lines;
}

// Placement computes a priority from a neighbour the caller already saw in `list`.
function placement(store, opts, excludeId) {
  const others = Object.entries(store.items).filter(([id]) => id !== excludeId).sort(byPriority);
  if (opts.priority !== undefined) {
    const n = Number(opts.priority);
    if (!Number.isFinite(n)) refuse("--priority", "must be a number");
    return n;
  }
  if (opts.first) return others.length ? others[0][1].priority - STEP : STEP;
  const ref = opts.after !== undefined ? ["after", opts.after] : opts.before !== undefined ? ["before", opts.before] : null;
  if (ref) {
    const { id } = getItem(store, ref[1]);
    const i = others.findIndex(([oid]) => oid === id);
    if (i === -1) refuse("placement", `cannot place ${excludeId} relative to itself`);
    const p = others[i][1].priority;
    if (ref[0] === "after") return i === others.length - 1 ? p + STEP : (p + others[i + 1][1].priority) / 2;
    return i === 0 ? p - STEP : (others[i - 1][1].priority + p) / 2;
  }
  return others.length ? others[others.length - 1][1].priority + STEP : STEP;
}

// ------------------------------------------------------------- store commands

function cmdList(ctx, _args, opts) {
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
    if (opts.status === "done") picked.sort((a, b) => (b[1].ts_done || "").localeCompare(a[1].ts_done || "") || b[0].localeCompare(a[0]));
  } else {
    const now = entries.filter(([, it]) => it.status === "now");
    const done = entries
      .filter(([, it]) => it.status === "done")
      .sort((a, b) => (b[1].ts_done || "").localeCompare(a[1].ts_done || "") || b[0].localeCompare(a[0]))
      .slice(0, 3);
    picked = now.concat(done);
  }
  if (!picked.length) return ctx.report("(none)");
  picked.forEach(([id, it]) => ctx.report(line(id, it)));
}

function daysBetween(from, to) {
  if (!from) return Infinity;
  return Math.floor((Date.parse(to) - Date.parse(from)) / 86400000);
}

function archiveFiles(ctx) {
  const dir = path.join(ctx.arch, "archive");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^items-\d{4}-\d{2}\.json$/.test(f)).sort().map((f) => path.join(dir, f));
}

function cmdFind(ctx, [text]) {
  if (!text) refuse("find", "needs a search string");
  const needle = text.toLowerCase();
  const { store } = loadStore(ctx);
  let hits = 0;
  Object.entries(store.items).sort(byPriority).forEach(([id, it]) => {
    if (it.content.join("\n").toLowerCase().includes(needle)) { ctx.report(`${line(id, it)}  (${it.status})`); hits++; }
  });
  archiveFiles(ctx).forEach((f) => {
    let arch;
    try { arch = JSON.parse(fs.readFileSync(f, "utf8")); } catch { refuse(f, "not valid JSON"); }
    Object.entries(arch.items || {}).forEach(([id, it]) => {
      if (it.content.join("\n").toLowerCase().includes(needle)) { ctx.report(`${line(id, it)}  (archived: ${path.basename(f)})`); hits++; }
    });
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
  const found = getItem(store, id);
  const it = found.item;
  ctx.report(`${found.id}  ${it.status}  created ${it.ts_created || "?"}  started ${it.ts_started || "-"}  done ${it.ts_done || "-"}  touched ${it.ts_touched || "?"}`);
  ctx.report("");
  it.content.forEach((l) => ctx.report(l));
}

function cmdCount(ctx) {
  const { store } = loadStore(ctx);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  Object.values(store.items).forEach((it) => counts[it.status]++);
  ctx.report(STATUSES.map((s) => `${s} ${counts[s]}`).join("  "));
  let archived = 0;
  archiveFiles(ctx).forEach((f) => { archived += Object.keys(JSON.parse(fs.readFileSync(f, "utf8")).items || {}).length; });
  ctx.report(`archived ${archived}  last flush ${store.last_flush || "never"}`);
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
      out.push(`### \`${id}\` ${title(it)}`, "");
      const body = it.content.slice(1).join("\n").replace(/^\n+|\n+$/g, "");
      if (body) out.push(body, "");
    });
  });
  ctx.report(out.length ? out.join("\n").replace(/\n+$/, "") : "(empty)");
}

function cmdAdd(ctx, [markdown], opts) {
  if (!markdown) refuse("add", 'needs "<markdown>" (first line is the title)');
  const status = opts.status || "now";
  if (status !== "now" && status !== "parked") refuse("add", "--status must be now or parked");
  const loaded = loadStore(ctx);
  const { store } = loaded;
  const id = "t" + String(store.next_id).padStart(3, "0");
  const d = nowISO();
  store.items[id] = {
    content: toLines(markdown),
    status,
    priority: placement(store, opts, id),
    ts_created: d,
    ts_started: status === "now" ? d : null,
    ts_done: null,
    ts_touched: d,
  };
  store.next_id++;
  saveStore(ctx, loaded);
  ctx.report(`${id} added (${status})`);
}

function cmdTransition(target) {
  return (ctx, [id]) => {
    const loaded = loadStore(ctx);
    const { id: realId, item } = getItem(loaded.store, id);
    const d = nowISO();
    item.status = target;
    item.ts_touched = d;
    item.ts_done = target === "done" ? d : null;
    if (target === "now" && !item.ts_started) item.ts_started = d;
    saveStore(ctx, loaded);
    ctx.report(`${realId} -> ${target}`);
  };
}

function cmdEdit(ctx, [id, markdown]) {
  if (!id || !markdown) refuse("edit", 'needs <id> "<markdown>"');
  const loaded = loadStore(ctx);
  const { id: realId, item } = getItem(loaded.store, id);
  item.content = toLines(markdown);
  item.ts_touched = nowISO();
  saveStore(ctx, loaded);
  ctx.report(`${realId} edited`);
}

function cmdMove(ctx, [id], opts) {
  const loaded = loadStore(ctx);
  const { id: realId, item } = getItem(loaded.store, id);
  if (!["after", "before", "first", "last", "priority"].some((k) => opts[k] !== undefined)) {
    refuse("move", "needs a placement: --after=<id> | --before=<id> | --first | --last");
  }
  item.priority = placement(loaded.store, opts, realId);
  item.ts_touched = nowISO();
  saveStore(ctx, loaded);
  ctx.report(`${realId} moved`);
}

// Moves done and dropped items out of the live store. Nothing else is touched.
function cmdFlush(ctx, _args, opts) {
  const loaded = loadStore(ctx);
  const { store } = loaded;
  const before = opts.before;
  const moving = Object.entries(store.items).filter(([, it]) =>
    (it.status === "done" || it.status === "dropped") && (!before || (it.ts_done || it.ts_touched || "") < before)
  );
  if (!moving.length) return ctx.report("nothing to flush");

  const month = today().slice(0, 7);
  const file = path.join(ctx.arch, "archive", `items-${month}.json`);
  let arch = { items: {} };
  if (fs.existsSync(file)) {
    try { arch = JSON.parse(fs.readFileSync(file, "utf8")); } catch { refuse(file, "not valid JSON -- fix by hand"); }
    if (!arch.items) refuse(file, 'expected {"items": {...}}');
  }
  moving.forEach(([id, it]) => {
    if (arch.items[id]) refuse(file, `${id} already archived this month -- ids must never collide`);
    arch.items[id] = it;
  });
  ctx.write(file, JSON.stringify(arch, null, 2) + "\n");
  moving.forEach(([id]) => delete store.items[id]);
  store.last_flush = nowISO();
  saveStore(ctx, loaded);
  ctx.report(`flushed ${moving.length} item${moving.length === 1 ? "" : "s"} into archive/items-${month}.json: ${moving.map(([id]) => id).join(" ")}`);
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

function cmdCheck(ctx) {
  let problems = 0;
  const say = (m) => { problems++; ctx.report(m); };

  try { loadStore(ctx); } catch (e) { if (e instanceof Refusal) say(e.message); else throw e; }
  archiveFiles(ctx).forEach((f) => {
    try { JSON.parse(fs.readFileSync(f, "utf8")); } catch { say(`${path.relative(ctx.root, f)}: not valid JSON`); }
  });

  const tFile = path.join(ctx.arch, "TODO.md");
  if (fs.existsSync(tFile) && !/^## Context$/m.test(fs.readFileSync(tFile, "utf8"))) say('TODO.md: missing "## Context"');

  const dDir = path.join(ctx.arch, "plans", "decisions");
  if (fs.existsSync(dDir)) {
    const required = ["Problem", "Options considered", "Decision", "Why not the alternatives", "Next step"];
    fs.readdirSync(dDir).filter((f) => f.endsWith(".md")).forEach((f) => {
      const text = fs.readFileSync(path.join(dDir, f), "utf8");
      required.forEach((sec) => {
        if (!new RegExp(`^## ${sec}$`, "m").test(text)) say(`plans/decisions/${f}: missing "## ${sec}"`);
      });
    });
  }
  ctx.report(problems ? `${problems} problem${problems === 1 ? "" : "s"} -- fix by hand; this script will not rewrite them` : "all managed files conform");
}

function cmdNewDecision(ctx, [name]) {
  if (!name) refuse("new-decision", "needs a title");
  const dir = path.join(ctx.arch, "plans", "decisions");
  if (!ctx.dryRun) fs.mkdirSync(dir, { recursive: true });
  const used = fs.existsSync(dir)
    ? fs.readdirSync(dir).map((f) => parseInt((f.match(/^(\d{3})-/) || [])[1], 10)).filter(Number.isInteger)
    : [];
  const n = String((used.length ? Math.max(...used) : 0) + 1).padStart(3, "0");
  const file = path.join(dir, `${n}-${slugify(name)}.md`);
  const body = template("decision-record.md")
    .replace("# Decision NNN — <Title>", `# Decision ${n} — ${name}`)
    .replace("Date: DD-MM-YYYY HH:MM", `Date: ${nowEuro()}`);
  ctx.write(file, body);
  ctx.report(`created plans/decisions/${path.basename(file)}`);
}

function cmdNewPlan(ctx, [topic]) {
  if (!topic) refuse("new-plan", "needs a topic");
  const dir = path.join(ctx.arch, "plans");
  if (!ctx.dryRun) fs.mkdirSync(dir, { recursive: true });
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
  "new-decision": cmdNewDecision,
  "new-plan": cmdNewPlan,
};

const BOOLEAN_FLAGS = ["private", "dry-run", "first", "last"];

function main(argv) {
  const cmd = argv[0];
  if (!cmd || cmd === "--help" || cmd === "-h" || !COMMANDS[cmd]) {
    const usage = fs.readFileSync(__filename, "utf8").split("\n").slice(4, 21).map((l) => l.replace(/^\/\/ ?/, "")).join("\n");
    console.log(usage);
    process.exit(cmd && !COMMANDS[cmd] ? 1 : 0);
  }

  const opts = {};
  const positional = [];
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { positional.push(a); continue; }
    const eq = a.indexOf("=");
    const key = (eq === -1 ? a.slice(2) : a.slice(2, eq));
    const camel = key.replace(/-(\w)/, (_, c) => c.toUpperCase());
    if (BOOLEAN_FLAGS.includes(key)) opts[camel] = true;
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
      if (opts.dryRun) { lines.push(`[dry-run] would write ${path.relative(root, file)}`); return; }
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    },
  };

  try {
    COMMANDS[cmd](ctx, positional, opts);
    lines.forEach((l) => console.log(l));
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
