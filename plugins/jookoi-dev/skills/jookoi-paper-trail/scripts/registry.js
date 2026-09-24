// Registry of repos that use jookoi-paper-trail: a JSON array of absolute paths in
// ~/.jookoi-paper-trail/repos.json. Written by the script on use, read by the viewer.

const fs = require("fs");
const os = require("os");
const path = require("path");

const CONFIG_DIR = path.join(os.homedir(), ".jookoi-paper-trail");
const CONFIG = path.join(CONFIG_DIR, "repos.json");

const key = (p) => (process.platform === "win32" ? path.resolve(p).toLowerCase() : path.resolve(p));

function read() {
  try {
    const list = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
    return Array.isArray(list) ? list.filter((p) => typeof p === "string").map((p) => path.resolve(p)) : [];
  } catch {
    return [];
  }
}

function write(list) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG, JSON.stringify(list, null, 2) + "\n");
}

// Scratch checkouts under the OS temp folder are never registered on their own.
function isTemp(root) {
  const rel = path.relative(key(os.tmpdir()), key(root));
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

// Returns true when the repo was newly added.
function register(root, { force = false } = {}) {
  const target = path.resolve(root);
  if (!force && isTemp(target)) return false;
  const list = read();
  if (list.some((p) => key(p) === key(target))) return false;
  write([...list, target]);
  return true;
}

function unregister(root) {
  const target = key(root);
  write(read().filter((p) => key(p) !== target));
}

module.exports = { CONFIG, read, write, register, unregister };
