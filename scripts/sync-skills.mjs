#!/usr/bin/env node
// Copies every skill under plugins/*/skills/ into each folder listed in SKILL_TARGETS
// (from .env, defaults to ~/.agents/skills and ~/.claude/skills).
// Skips skills whose target copy is identical, and skips (with a warning) targets that are
// newer than this repo's copy unless --force is passed. Never deletes skills it does not own.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_TARGETS = '~/.agents/skills,~/.claude/skills'
const force = process.argv.includes('--force')
const dryRun = process.argv.includes('--dry-run')

function loadEnv() {
  const envPath = path.join(rootDir, '.env')
  const env = {}
  if (!fs.existsSync(envPath)) return env
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return env
}

function resolveTarget(p) {
  const expanded = p === '~' ? os.homedir() : p.replace(/^~[\\/]/, os.homedir() + path.sep)
  return path.resolve(rootDir, expanded)
}

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    return e.isDirectory() ? listFiles(full, base) : [path.relative(base, full)]
  }).sort()
}

// Content hash and newest mtime of a skill folder.
function fingerprint(dir) {
  const hash = crypto.createHash('sha1')
  let newest = 0
  for (const rel of listFiles(dir)) {
    const full = path.join(dir, rel)
    hash.update(rel.replace(/\\/g, '/')).update(fs.readFileSync(full))
    newest = Math.max(newest, fs.statSync(full).mtimeMs)
  }
  return { hash: hash.digest('hex'), newest }
}

function findSkills() {
  const pluginsDir = path.join(rootDir, 'plugins')
  const skills = []
  for (const plugin of fs.readdirSync(pluginsDir, { withFileTypes: true })) {
    const skillsDir = path.join(pluginsDir, plugin.name, 'skills')
    if (!plugin.isDirectory() || !fs.existsSync(skillsDir)) continue
    for (const s of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (s.isDirectory() && fs.existsSync(path.join(skillsDir, s.name, 'SKILL.md'))) {
        skills.push({ name: s.name, dir: path.join(skillsDir, s.name) })
      }
    }
  }
  return skills
}

const env = loadEnv()
const targets = (env.SKILL_TARGETS || DEFAULT_TARGETS).split(',').map((t) => t.trim()).filter(Boolean).map(resolveTarget)
const skills = findSkills()
const counts = { copied: 0, same: 0, skipped: 0 }

console.log(`${dryRun ? '[dry run] ' : ''}Syncing ${skills.length} skill(s) to ${targets.length} target(s)\n`)

for (const target of targets) {
  console.log(target)
  for (const skill of skills) {
    const dest = path.join(target, skill.name)
    const src = fingerprint(skill.dir)
    let action = 'new'
    if (fs.existsSync(dest)) {
      const cur = fingerprint(dest)
      if (cur.hash === src.hash) { counts.same++; continue }
      if (cur.newest > src.newest && !force) {
        counts.skipped++
        console.log(`  skipped  ${skill.name}  (target is newer, use --force to overwrite)`)
        continue
      }
      action = 'updated'
    }
    if (!dryRun) {
      fs.rmSync(dest, { recursive: true, force: true })
      fs.mkdirSync(target, { recursive: true })
      fs.cpSync(skill.dir, dest, { recursive: true })
    }
    counts.copied++
    console.log(`  ${action.padEnd(8)} ${skill.name}`)
  }
}

console.log(`\n${counts.copied} copied, ${counts.same} already current, ${counts.skipped} skipped`)
process.exit(counts.skipped ? 1 : 0)