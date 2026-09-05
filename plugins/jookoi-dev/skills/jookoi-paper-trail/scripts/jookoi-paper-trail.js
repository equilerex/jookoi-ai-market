#!/usr/bin/env node
// jookoi-paper-trail — context-file mechanics.
// Design: _architecture/plans/2026-08-30-jookoi-paper-trail.md
// Redesign: _architecture/plans/2026-09-02-jookoi-doc-redesign.md
// Spec:   ../references/file-formats.md, ../references/pipeline.md
//
// Usage:
//   jookoi-paper-trail backlog "<title>" "<body>" [--status OPEN]
//   jookoi-paper-trail flush --title "<t>"                  TODO.md -> archive/YYYY-MM.md, reset TODO.md
//   jookoi-paper-trail status                                checklist counts, last flush date
//   jookoi-paper-trail stale                                 updated: vs folder's last commit
//   jookoi-paper-trail check                                 validate managed files against the spec
//   jookoi-paper-trail new-decision "<title>"                next NNN from template
//   jookoi-paper-trail new-plan "<topic>"                    dated plan file from template
//
// Global flags: --private (operate on _jookoi-architecture/), --root <path>, --dry-run
//
// This script owns mechanics only: dating, heading grammar, newest-first insertion,
// archive-index pointers, NNN allocation, updated: bumping, template instantiation,
// the session marker. Judgement -- what happened, where it belongs, what TODO.md's
// Context header says, and what survives into BACKLOG.md before a flush -- stays
// with the model. TODO.md's checklist is plain-text and hand-edited; the script
// only touches it during flush.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ENTRY_RE = /^## (\d{4}-\d{2}-\d{2}) — (.+)$/;
const TEMPLATES = path.join(__dirname, "..", "assets", "templates");
const BACKLOG_STATUS = ["OPEN", "DESIGNED", "BLOCKED", "MOVED", "DROPPED"];

class Refusal extends Error {}
function refuse(file, detail) {
  throw new Refusal(`${file}: ${detail}`);
}

// ---------------------------------------------------------------- environment

function repoRoot(explicit) {
  if (explicit) return path.resolve(explicit);
  try {
    return execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
  } catch {
    return process.cwd();
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

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function template(name) {
  return fs.readFileSync(path.join(TEMPLATES, name), "utf8");
}

function readOrTemplate(file, templateName) {
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  return template(templateName);
}

// ------------------------------------------------------------------- parsing

// Splits a document body into `## YYYY-MM-DD — Title` entries. Text before the
// first entry is returned as `preamble`. Refuses on a `##` heading that is not an
// entry, since that means the file is not in the shape this script can move.
function parseEntries(text, file, { allowOtherHeadings = false } = {}) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  const preamble = [];
  let current = null;

  lines.forEach((line, i) => {
    const m = line.match(ENTRY_RE);
    if (m) {
      if (current) entries.push(current);
      current = { date: m[1], title: m[2], body: [], line: i + 1 };
      return;
    }
    if (/^## /.test(line) && !allowOtherHeadings) {
      refuse(file, `line ${i + 1}: heading is not a dated entry -- expected "## YYYY-MM-DD — Title", got ${JSON.stringify(line)}`);
    }
    (current ? current.body : preamble).push(line);
  });
  if (current) entries.push(current);

  entries.forEach((e) => {
    e.body = e.body.join("\n").replace(/^\n+|\n+$/g, "");
  });
  return { preamble: preamble.join("\n").replace(/\n+$/, ""), entries };
}

function renderEntries(entries) {
  return entries.map((e) => `## ${e.date} — ${e.title}\n\n${e.body}`).join("\n\n");
}

// Newest first; stable within a date so an earlier flush keeps its position.
function sortEntries(entries) {
  return entries.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// TODO.md is the one file with two differently-behaving blocks: a wholesale-
// rewritten Context header and a hand-maintained Checklist.
function splitTodo(text, file) {
  const cIdx = text.indexOf("\n## Context");
  const kIdx = text.indexOf("\n## Checklist");
  if (cIdx === -1) refuse(file, 'missing "## Context" heading');
  if (kIdx === -1) refuse(file, 'missing "## Checklist" heading');
  if (kIdx < cIdx) refuse(file, '"## Checklist" appears before "## Context"');
  return {
    head: text.slice(0, cIdx).replace(/\n+$/, ""),
    context: text.slice(cIdx + 1, kIdx).replace(/^## Context\n?/, "").replace(/\n+$/, ""),
    checklist: text.slice(kIdx + 1).replace(/^## Checklist\n?/, "").replace(/^\n+|\n+$/g, ""),
  };
}

function joinTodo(parts) {
  return [
    parts.head,
    "",
    "## Context",
    "",
    parts.context.trim(),
    "",
    "## Checklist",
    "",
    parts.checklist.trim(),
    "",
  ].join("\n").replace(/\n{3,}/g, "\n\n");
}

// ------------------------------------------------------------------ commands

function cmdBacklog(ctx, [title, body], opts) {
  if (!title || !body) refuse("backlog", "needs a title and a body");
  const status = (opts.status || "OPEN").toUpperCase();
  if (!BACKLOG_STATUS.includes(status)) {
    refuse("backlog", `Status ${status} is outside ${BACKLOG_STATUS.join(" | ")}`);
  }
  const file = path.join(ctx.arch, "BACKLOG.md");
  const text = readOrTemplate(file, "BACKLOG.md").replace(/\n+$/, "");
  if (new RegExp(`^## ${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m").test(text)) {
    refuse(file, `an item titled "${title}" already exists -- edit it rather than adding a second`);
  }
  ctx.write(file, `${text}\n\n## ${title}\n\nStatus: ${status}\n\n${body}\n`);
  ctx.report(`backlog += "${title}" (${status})`);
}

function cmdFlush(ctx, _args, opts) {
  if (!opts.title) refuse("flush", "needs --title \"<t>\"");
  const tFile = path.join(ctx.arch, "TODO.md");
  if (!fs.existsSync(tFile)) refuse(tFile, "does not exist -- nothing to flush");
  const parts = splitTodo(fs.readFileSync(tFile, "utf8"), tFile);

  if (!parts.checklist.trim() && !parts.context.trim()) {
    ctx.report("TODO.md is already empty -- nothing to flush");
    return;
  }

  const body = [
    parts.context.trim() ? `Context:\n\n${parts.context.trim()}` : "",
    parts.checklist.trim() ? `Checklist:\n\n${parts.checklist.trim()}` : "",
  ].filter(Boolean).join("\n\n");

  const date = today();
  const month = date.slice(0, 7);
  const archDirPath = path.join(ctx.arch, "archive");
  const mFile = path.join(archDirPath, `${month}.md`);
  const mText = fs.existsSync(mFile)
    ? fs.readFileSync(mFile, "utf8")
    : template("archive-month.md").replace(/YYYY-MM/g, month);
  const parsed = parseEntries(mText, mFile);

  const existing = parsed.entries.find((e) => e.date === date && e.title === opts.title);
  if (existing) {
    existing.body = existing.body ? `${existing.body}\n\n${body}` : body;
  } else {
    parsed.entries.push({ date, title: opts.title, body });
  }
  ctx.write(mFile, `${parsed.preamble}\n\n${renderEntries(sortEntries(parsed.entries))}\n`);
  updateArchiveIndex(ctx, archDirPath);

  ctx.write(tFile, template("todo.md"));

  writeMarker(ctx, opts);

  ctx.report(`flushed TODO.md into archive/${month}.md as "${opts.title}"`);
  ctx.report("TODO.md reset to template.");
  ctx.report("");
  ctx.report("Before you called this, you should already have moved anything still relevant into BACKLOG.md.");
  ctx.report("If you didn't, it's gone from the live working set now -- check archive/" + month + ".md.");
}

function updateArchiveIndex(ctx, archDirPath) {
  const iFile = path.join(archDirPath, "index.md");
  const iText = readOrTemplate(iFile, "archive-index.md");
  const head = iText.split("\n").slice(0, 2).join("\n");

  const months = fs.existsSync(archDirPath)
    ? fs.readdirSync(archDirPath).filter((f) => /^\d{4}-\d{2}\.md$/.test(f)).sort().reverse()
    : [];

  const existing = new Map();
  iText.split("\n").forEach((l) => {
    const m = l.match(/^- \*\*`(\d{4}-\d{2}\.md)`\*\* — [^:]*: (.*)$/);
    if (m) existing.set(m[1], m[2]);
  });

  const pointers = months.map((f) => {
    const parsed = parseEntries(fs.readFileSync(path.join(archDirPath, f), "utf8"), f);
    const dates = parsed.entries.map((e) => e.date).sort();
    const range = dates.length ? (dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} to ${dates[dates.length - 1]}`) : "empty";
    const summary = existing.get(f) || parsed.entries.map((e) => e.title).slice(0, 3).join("; ") || "no entries";
    return `- **\`${f}\`** — ${range}: ${summary}`;
  });

  ctx.write(iFile, `${head}\n\n${pointers.join("\n")}\n`);
  ctx.report(`archive/index.md now lists ${pointers.length} file${pointers.length === 1 ? "" : "s"}`);
}

function cmdStatus(ctx) {
  const files = ["TODO.md", "BACKLOG.md", "ARCHITECTURE.md"];
  files.forEach((f) => {
    const p = path.join(ctx.arch, f);
    if (!fs.existsSync(p)) return ctx.report(`${f.padEnd(20)} absent`);
    const n = fs.readFileSync(p, "utf8").split("\n").length;
    ctx.report(`${f.padEnd(20)} ${n} lines`);
  });

  const tFile = path.join(ctx.arch, "TODO.md");
  if (fs.existsSync(tFile)) {
    const parts = splitTodo(fs.readFileSync(tFile, "utf8"), tFile);
    const done = (parts.checklist.match(/^- \[x\]/gim) || []).length;
    const open = (parts.checklist.match(/^- \[ \]/gm) || []).length;
    ctx.report("");
    ctx.report(`checklist: ${open} open, ${done} done`);
    ctx.report(open + done === 0 ? "checklist is empty" : "");
  }

  const archDirPath = path.join(ctx.arch, "archive");
  const months = fs.existsSync(archDirPath)
    ? fs.readdirSync(archDirPath).filter((f) => /^\d{4}-\d{2}\.md$/.test(f)).sort().reverse()
    : [];
  if (months.length) {
    const latest = parseEntries(fs.readFileSync(path.join(archDirPath, months[0]), "utf8"), months[0]);
    const dates = sortEntries(latest.entries).map((e) => e.date);
    if (dates.length) ctx.report(`last flush: ${dates[0]}`);
  }

  const marker = markerPath(ctx, {});
  if (marker) ctx.report(fs.existsSync(marker) ? "flush marker present for this session" : "no flush marker for this session");
}

function cmdStale(ctx) {
  const out = execSync("git ls-files", { cwd: ctx.root, encoding: "utf8" }).split("\n");
  const contexts = out.filter((f) => /(^|\/)(_jookoi-)?CONTEXT\.md$/.test(f));
  if (contexts.length === 0) return ctx.report("no context files found -- nothing to check");

  let flagged = 0;
  contexts.forEach((rel) => {
    const abs = path.join(ctx.root, rel);
    const m = fs.readFileSync(abs, "utf8").match(/^updated:\s*(\d{4}-\d{2}-\d{2})/m);
    if (!m) { ctx.report(`${rel}  NO updated: LINE`); flagged++; return; }
    const dir = path.dirname(rel);
    let committed;
    try {
      committed = execSync(`git log -1 --format=%cd --date=short -- "${dir}"`, { cwd: ctx.root, encoding: "utf8" }).trim();
    } catch { return; }
    if (committed && committed > m[1]) {
      ctx.report(`${rel}  updated ${m[1]}, folder committed ${committed}  LIKELY STALE`);
      flagged++;
    }
  });
  ctx.report("");
  ctx.report(flagged ? `${flagged} of ${contexts.length} flagged` : `${contexts.length} checked, none stale`);
}

function cmdCheck(ctx) {
  let problems = 0;
  const say = (m) => { problems++; ctx.report(m); };

  const tFile = path.join(ctx.arch, "TODO.md");
  if (fs.existsSync(tFile)) {
    try { splitTodo(fs.readFileSync(tFile, "utf8"), tFile); } catch (e) { say(String(e.message)); }
  }

  const archDirPath = path.join(ctx.arch, "archive");
  if (fs.existsSync(archDirPath)) {
    fs.readdirSync(archDirPath).filter((f) => /^\d{4}-\d{2}\.md$/.test(f)).forEach((f) => {
      const p = path.join(archDirPath, f);
      try { parseEntries(fs.readFileSync(p, "utf8"), p); } catch (e) { say(String(e.message)); }
    });
  }

  const bFile = path.join(ctx.arch, "BACKLOG.md");
  if (fs.existsSync(bFile)) {
    const text = fs.readFileSync(bFile, "utf8");
    const heads = [...text.matchAll(/^## (.+)$/gm)];
    heads.forEach((h) => {
      const after = text.slice(h.index).split("\n").slice(1, 4).join("\n");
      const s = after.match(/^Status:\s*(\S+)/m);
      if (!s) say(`BACKLOG.md: "${h[1]}" has no Status: line`);
      else if (!BACKLOG_STATUS.includes(s[1])) say(`BACKLOG.md: "${h[1]}" Status ${s[1]} outside ${BACKLOG_STATUS.join(" | ")}`);
    });
  }

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

  ctx.report("");
  ctx.report(problems ? `${problems} problem${problems === 1 ? "" : "s"} -- fix by hand; this script will not rewrite them` : "all managed files conform");
}

function cmdNewDecision(ctx, [title]) {
  if (!title) refuse("new-decision", "needs a title");
  const dir = path.join(ctx.arch, "plans", "decisions");
  if (!ctx.dryRun) fs.mkdirSync(dir, { recursive: true });
  const used = fs.existsSync(dir)
    ? fs.readdirSync(dir).map((f) => parseInt((f.match(/^(\d{3})-/) || [])[1], 10)).filter(Number.isInteger)
    : [];
  const n = String((used.length ? Math.max(...used) : 0) + 1).padStart(3, "0");
  const file = path.join(dir, `${n}-${slugify(title)}.md`);
  const body = template("decision-record.md")
    .replace("# Decision NNN — <Title>", `# Decision ${n} — ${title}`)
    .replace("Date: YYYY-MM-DD", `Date: ${today()}`);
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
    .replace("Session: YYYY-MM-DD.", `Session: ${today()}.`);
  ctx.write(file, body);
  ctx.report(`created plans/${path.basename(file)}`);
}

// -------------------------------------------------------------------- marker

function markerPath(ctx, opts) {
  const id = opts.session || process.env.CLAUDE_SESSION_ID || process.env.JOOKOI_SESSION_ID;
  if (!id) return null;
  return path.join(ctx.root, "_jookoi-architecture", `.jookoi-paper-trail-ran-${id}`);
}

function writeMarker(ctx, opts) {
  const p = markerPath(ctx, opts);
  if (!p) return;
  if (!ctx.dryRun) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, `${new Date().toISOString()}\n`);
  }
}

// ---------------------------------------------------------------------- main

const COMMANDS = {
  backlog: cmdBacklog,
  flush: cmdFlush,
  status: cmdStatus,
  stale: cmdStale,
  check: cmdCheck,
  "new-decision": cmdNewDecision,
  "new-plan": cmdNewPlan,
};

function main(argv) {
  const cmd = argv[0];
  if (!cmd || cmd === "--help" || cmd === "-h" || !COMMANDS[cmd]) {
    const usage = fs.readFileSync(__filename, "utf8").split("\n").slice(5, 16).map((l) => l.replace(/^\/\/ ?/, "")).join("\n");
    console.log(usage);
    process.exit(cmd && !COMMANDS[cmd] ? 1 : 0);
  }

  const opts = { private: false, dryRun: false };
  const positional = [];
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--private") opts.private = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--root") opts.root = argv[++i];
    else if (a === "--title") opts.title = argv[++i];
    else if (a === "--status") opts.status = argv[++i];
    else if (a === "--session") opts.session = argv[++i];
    else if (a.startsWith("--")) { console.error(`Unknown flag: ${a}`); process.exit(1); }
    else positional.push(a);
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
      fs.writeFileSync(file, content.replace(/\n{3,}/g, "\n\n"));
    },
  };

  try {
    COMMANDS[cmd](ctx, positional, opts);
    lines.forEach((l) => console.log(l));
  } catch (e) {
    if (e instanceof Refusal) {
      console.error(`REFUSED -- ${e.message}`);
      console.error("Nothing was written. Fix the file by hand; this script does not rewrite content it did not write.");
      process.exit(2);
    }
    throw e;
  }
}

main(process.argv.slice(2));
