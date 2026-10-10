#!/usr/bin/env node
// The release procedure for the marketplace. CI runs it on every push to main (.github/workflows/release.yml).
//
//   npm run release                  fix metadata, validate, audit (no version change)
//   npm run release -- --commit      release: bump every plugin's version, validate, audit, commit, tag
//   npm run release -- --install     local only: also refresh this machine's Claude Code installs
//
// A push is a release: whoever pushes decides a bump is needed. Steps stop at the first failure.
// This script never pushes; CI pushes.

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const flags = new Set(process.argv.slice(2))
const install = flags.has('--install')
const commit = flags.has('--commit')
const isWin = process.platform === 'win32'

function run(label, cmd, args, { fatal = true } = {}) {
  console.log(`\n== ${label}`)
  console.log(`> ${[cmd, ...args].join(' ')}`)
  const r = spawnSync(cmd, args, { cwd: rootDir, stdio: 'inherit', shell: isWin })
  const ok = r.status === 0
  if (!ok && fatal) {
    console.error(`\nRelease stopped at: ${label}`)
    process.exit(r.status ?? 1)
  }
  return ok
}

function git(args) {
  const r = spawnSync('git', args, { cwd: rootDir, encoding: 'utf8' })
  return { ok: r.status === 0, out: (r.stdout || '').trim() }
}

function marketplaceName() {
  const m = JSON.parse(fs.readFileSync(path.join(rootDir, '.claude-plugin', 'marketplace.json'), 'utf8'))
  return { market: m.name, plugins: m.plugins.map((p) => p.name) }
}

function pluginVersion(name) {
  const p = path.join(rootDir, 'plugins', name, '.claude-plugin', 'plugin.json')
  return JSON.parse(fs.readFileSync(p, 'utf8')).version
}

const { market, plugins } = marketplaceName()
const versionsBefore = Object.fromEntries(plugins.map((p) => [p, pluginVersion(p)]))

// Every release bumps every plugin (minor, x.y+1.0). The release itself is the reason for the bump.
function bumpPlugin(name) {
  const p = path.join(rootDir, 'plugins', name, '.claude-plugin', 'plugin.json')
  const raw = fs.readFileSync(p, 'utf8')
  const [major, minor] = pluginVersion(name).split('.').map(Number)
  fs.writeFileSync(p, raw.replace(/("version"\s*:\s*")[^"]+(")/, `$1${major}.${minor + 1}.0$2`), 'utf8')
}
if (commit) for (const name of plugins) bumpPlugin(name)

// 1. Metadata, version bumps, manifest validation, reference audit. This is the same
//    script as `npm run update-skills`; it exits non-zero if anything still needs a human.
run('Fix metadata, bump changed plugin versions, validate manifests, audit references',
  process.execPath, [path.join(rootDir, 'scripts', 'check-marketplace-skills.mjs'), '--update'])

const bumped = plugins.filter((p) => pluginVersion(p) !== versionsBefore[p])
if (commit && bumped.length === 0) {
  console.error('Release requested but no plugin version changed.')
  process.exit(1)
}

// 2. Claude Code side: register the local marketplace, refresh it, then install or update each plugin.
if (install) {
  // `add` fails when the marketplace is already registered; that is fine.
  run('Register local marketplace', 'claude', ['plugin', 'marketplace', 'add', './'], { fatal: false })
  run('Refresh marketplace', 'claude', ['plugin', 'marketplace', 'update', market])
  for (const name of plugins) {
    const id = `${name}@${market}`
    const updated = run(`Update ${id}`, 'claude', ['plugin', 'update', id], { fatal: false })
    if (!updated) run(`Install ${id}`, 'claude', ['plugin', 'install', id])
  }
}

// 3. Optional local commit of the release (never pushed).
if (commit) {
  const status = git(['status', '--porcelain', '--', 'plugins', 'README.md', '_architecture', '.claude-plugin'])
  if (!status.out) {
    console.log('\n== Commit: nothing to commit')
  } else {
    const versions = plugins.map((p) => `${p} ${pluginVersion(p)}`).join(', ')
    const message = [
      `release: ${versions}`,
      '',
      'Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>',
      'Claude-Session: https://claude.ai/code/session_01DEkL3ydzCaYX598CartaEw',
    ].join('\n')
    run('Stage release files', 'git', ['add', '--', 'plugins', 'README.md', '_architecture', '.claude-plugin'])
    run('Commit release', 'git', ['commit', '-m', message])
  }
  for (const name of bumped) {
    const tag = `${name}-v${pluginVersion(name)}`
    if (git(['rev-parse', '-q', '--verify', `refs/tags/${tag}`]).ok) continue
    run(`Tag ${tag}`, 'git', ['tag', '-a', tag, '-m', `${name} ${pluginVersion(name)}`])
  }
}

console.log(`\nRelease finished. Versions: ${plugins.map((p) => `${p} ${pluginVersion(p)}`).join(', ')}`)
if (bumped.length) console.log(`Bumped: ${bumped.map((p) => `${p} ${versionsBefore[p]} -> ${pluginVersion(p)}`).join(', ')}`)
if (!commit) console.log('Not released (no --commit). Nothing bumped, committed or tagged.')
