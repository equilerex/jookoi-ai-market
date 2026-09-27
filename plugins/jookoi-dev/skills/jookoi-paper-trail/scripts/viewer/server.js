#!/usr/bin/env node
// jookoi-paper-trail viewer: local web page over items.yaml and archive/items-*.yaml (read, plus adding items via the CLI),
// for every repo that has used the store. No dependencies beyond the vendored js-yaml.
//
//   node viewer/server.js                 serve on http://127.0.0.1:4173 (foreground)
//   node viewer/server.js ensure          start it in the background if it is not running, print the URL
//   node viewer/server.js add [path]      register a repo (default: the current repo root)
//   node viewer/server.js remove <path>   unregister
//   node viewer/server.js list            show registered repos
//   flags: --port N   --open (launch the browser)
//
// Repos register themselves: any jookoi-paper-trail script call in a repo with an items.yaml adds it to
// ~/.jookoi-paper-trail/repos.json. The server binds to 127.0.0.1, rejects foreign Host headers, and only
// reads the architecture folders of registered repos.

const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { execSync, spawn, spawnSync } = require("child_process");
const yaml = require("../vendor/js-yaml.cjs.js");
const registry = require("../registry.js");

const DEFAULT_PORT = 4173;
const LAYERS = { shared: "_architecture", private: "_jookoi-architecture" };
const APP = "jookoi-paper-trail-viewer";

function repoRootOf(dir) {
  try {
    return execSync("git rev-parse --show-toplevel", { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    let d = path.resolve(dir);
    for (;;) {
      if (Object.values(LAYERS).some((l) => fs.existsSync(path.join(d, l)))) return d;
      const up = path.dirname(d);
      if (up === d) return path.resolve(dir);
      d = up;
    }
  }
}

// ---------------------------------------------------------------- data

function readYaml(file) {
  return yaml.load(fs.readFileSync(file, "utf8"), { schema: yaml.CORE_SCHEMA });
}

function toItems(map, archivedFrom) {
  return Object.entries(map || {}).map(([id, it]) => ({
    id,
    title: String(it.title ?? ""),
    status: it.status,
    priority: it.priority,
    body: it.body || "",
    ts_created: it.ts_created || null,
    ts_started: it.ts_started || null,
    ts_done: it.ts_done || null,
    ts_touched: it.ts_touched || null,
    archived: archivedFrom || null,
  }));
}

// Signature of the YAML files behind a layer (name, mtime, size). Null when the layer folder is absent.
function layerSig(root, layer) {
  const dir = path.join(root, LAYERS[layer]);
  if (!fs.existsSync(dir)) return null;
  const files = [path.join(dir, "items.yaml")];
  const arch = path.join(dir, "archive");
  if (fs.existsSync(arch)) {
    fs.readdirSync(arch).filter((f) => /^items-\d{4}-\d{2}\.yaml$/.test(f)).sort().forEach((f) => files.push(path.join(arch, f)));
  }
  return files.map((f) => {
    try { const st = fs.statSync(f); return `${path.basename(f)}:${st.mtimeMs}:${st.size}`; } catch { return `${path.basename(f)}:-`; }
  }).join("|");
}

const dataCache = new Map();

// Re-reads the YAML only when the layer's signature changed.
function layerData(root, layer) {
  const sig = layerSig(root, layer);
  if (sig === null) return null;
  const key = root + "|" + layer;
  const hit = dataCache.get(key);
  if (hit && hit.sig === sig) return hit.data;
  const data = readLayer(root, layer);
  dataCache.set(key, { sig, data });
  return data;
}

function readLayer(root, layer) {
  const dir = path.join(root, LAYERS[layer]);
  const out = { layer, repo: path.basename(root).toLowerCase(), last_flush: null, items: [], error: null };
  try {
    const file = path.join(dir, "items.yaml");
    if (fs.existsSync(file)) {
      const store = readYaml(file);
      out.repo = store.repo || out.repo;
      out.last_flush = store.last_flush || null;
      out.items = toItems(store.items, null);
    }
    const arch = path.join(dir, "archive");
    if (fs.existsSync(arch)) {
      fs.readdirSync(arch)
        .filter((f) => /^items-\d{4}-\d{2}\.yaml$/.test(f))
        .sort()
        .forEach((f) => out.items.push(...toItems(readYaml(path.join(arch, f)).items, f)));
    }
  } catch (e) {
    out.error = String(e.message).split("\n")[0];
  }
  return out;
}

function summary(root, i) {
  const layers = {};
  let now = 0;
  for (const layer of Object.keys(LAYERS)) {
    const d = layerData(root, layer);
    layers[layer] = !!d;
    if (d && layer === "shared") now = d.items.filter((it) => it.status === "now" && !it.archived).length;
  }
  return { index: i, name: path.basename(root), path: root, exists: fs.existsSync(root), layers, now };
}

// ---------------------------------------------------------------- http

function send(res, code, type, body, headers) {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store", ...headers });
  res.end(body);
}

const CLI = path.join(__dirname, "..", "jookoi-paper-trail.js");

// Adds an item by calling the paper-trail CLI, so the store keeps a single writer with its own validation.
// kind: "immediate" -> status now, "backlog" -> status parked.
function addItem(root, layer, input) {
  const title = String(input.title || "").trim();
  const status = input.kind === "immediate" ? "now" : input.kind === "backlog" ? "parked" : null;
  if (!title || title.includes("\n")) return { code: 400, error: "title must be a non-empty single line" };
  if (!status) return { code: 400, error: "kind must be immediate or backlog" };
  const args = [CLI, "add", "-", "--root", root];
  if (layer === "private") args.push("--private");
  const payload = JSON.stringify({ title, body: String(input.body || ""), status });
  const r = spawnSync(process.execPath, args, { input: payload, encoding: "utf8", timeout: 15000, windowsHide: true });
  const out = ((r.stdout || "") + (r.stderr || "")).trim();
  if (r.status !== 0) return { code: 422, error: out.split("\n")[0] || "add failed" };
  return { code: 200, message: out.split("\n")[0] };
}

function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

const RENDER_BUNDLE = path.join(__dirname, "..", "vendor", "jookoi-mdx-render.browser.js");

function handler(port) {
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  return (req, res) => {
    // Blocks DNS-rebinding: a foreign page cannot reach this server under another hostname.
    if (!allowedHosts.has(req.headers.host)) return send(res, 403, "text/plain", "forbidden");
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return send(res, 200, "text/html; charset=utf-8", fs.readFileSync(path.join(__dirname, "index.html")));
    }
    if (url.pathname === "/vendor/jookoi-mdx-render.browser.js") {
      return send(res, 200, "text/javascript; charset=utf-8", fs.readFileSync(RENDER_BUNDLE));
    }
    if (url.pathname === "/api/ping") return send(res, 200, "application/json", JSON.stringify({ app: APP }));
    if (url.pathname === "/api/repos") {
      return send(res, 200, "application/json", JSON.stringify(registry.read().map((r, i) => summary(r, i))));
    }
    const add = url.pathname.match(/^\/api\/repo\/(\d+)\/items$/);
    if (add) {
      // The JSON content type forces a CORS preflight for foreign pages, and Origin must be this server.
      const okOrigin = !req.headers.origin || allowedHosts.has(req.headers.origin.replace(/^https?:\/\//, ""));
      if (req.method !== "POST" || !okOrigin || !/^application\/json/.test(req.headers["content-type"] || "")) {
        return send(res, 403, "application/json", '{"error":"forbidden"}');
      }
      const root = registry.read()[Number(add[1])];
      if (!root) return send(res, 404, "application/json", '{"error":"unknown repo"}');
      return readJson(req, 64 * 1024).then((input) => {
        const layer = LAYERS[input.layer] ? input.layer : "shared";
        const r = addItem(root, layer, input);
        send(res, r.code, "application/json", JSON.stringify(r.error ? { error: r.error } : { ok: true, message: r.message }));
      }).catch(() => send(res, 400, "application/json", '{"error":"bad request"}'));
    }
    const m = url.pathname.match(/^\/api\/repo\/(\d+)$/);
    if (m) {
      const root = registry.read()[Number(m[1])];
      const layer = url.searchParams.get("layer") || "shared";
      if (!root || !LAYERS[layer]) return send(res, 404, "application/json", '{"error":"unknown repo or layer"}');
      const data = layerData(root, layer);
      if (!data) return send(res, 404, "application/json", '{"error":"layer not found"}');
      // Conditional GET: the client polls this, and an unchanged store answers 304 with no body.
      const etag = '"' + crypto.createHash("sha1").update(layerSig(root, layer)).digest("hex").slice(0, 16) + '"';
      const cache = { ETag: etag, "Cache-Control": "no-cache" };
      if (req.headers["if-none-match"] === etag) { res.writeHead(304, cache); return res.end(); }
      return send(res, 200, "application/json", JSON.stringify(data), cache);
    }
    if (url.pathname === "/favicon.ico") { res.writeHead(204); return res.end(); }
    send(res, 404, "text/plain", "not found");
  };
}

// ---------------------------------------------------------------- ensure / open

function ping(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, path: "/api/ping", timeout: 400 }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => { try { resolve(JSON.parse(body).app === APP); } catch { resolve(false); } });
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

function openBrowser(url) {
  const opener = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  spawn(opener[0], opener[1], { stdio: "ignore", detached: true, windowsHide: true }).unref();
}

// Idempotent and quiet: prints the URL, or nothing and exit code 1 when it cannot be started.
async function ensure(port) {
  const url = `http://127.0.0.1:${port}`;
  if (await ping(port)) { console.log(url); return true; }
  spawn(process.execPath, [__filename, "--port", String(port)], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 150));
    if (await ping(port)) { console.log(url); return true; }
  }
  process.exitCode = 1;
  return false;
}

// ---------------------------------------------------------------- main

async function main(argv) {
  const cmd = argv[0];
  const flag = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const port = Number(flag("port")) || Number(process.env.JOOKOI_VIEWER_PORT) || DEFAULT_PORT;

  if (cmd === "add") {
    const target = repoRootOf(argv[1] && !argv[1].startsWith("--") ? argv[1] : process.cwd());
    return console.log(registry.register(target, { force: true }) ? `registered: ${target}` : `already registered: ${target}`);
  }
  if (cmd === "remove") {
    if (!argv[1]) return console.error("remove needs a path");
    const target = repoRootOf(argv[1]);
    registry.unregister(target);
    return console.log(`removed: ${target}`);
  }
  if (cmd === "list") {
    const list = registry.read();
    return console.log(list.length ? list.join("\n") : `(none) -- repos register themselves on use, or: add <path>. Config: ${registry.CONFIG}`);
  }
  if (cmd === "ensure") {
    const up = await ensure(port);
    if (up && argv.includes("--open")) openBrowser(`http://127.0.0.1:${port}`);
    return;
  }

  const here = repoRootOf(process.cwd());
  if (!registry.read().length && Object.values(LAYERS).some((l) => fs.existsSync(path.join(here, l)))) {
    registry.register(here, { force: true });
    console.log(`registered the current repo: ${here}`);
  }
  http.createServer(handler(port)).listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}`;
    console.log(`paper-trail viewer: ${url}   (Ctrl+C to stop)`);
    if (argv.includes("--open")) openBrowser(url);
  }).on("error", (e) => {
    console.error(e.code === "EADDRINUSE" ? `port ${port} is in use, pick another with --port` : e.message);
    process.exit(1);
  });
}

main(process.argv.slice(2));
