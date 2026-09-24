#!/usr/bin/env node
// Copies every skill under plugins/*/skills/ into each folder listed in SKILL_TARGETS
// (from .env, defaults to ~/.agents/skills,~/.claude/skills).
// Skips skills whose target copy is identical, and skips (with a warning) targets that are
// newer than this repo's copy unless --force is passed. Never deletes skills it does not own.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DEFAULT_TARGETS = '~/.agents/skills,~/.claude/skills'

export function loadEnv() {
  const envPath = path.join(rootDir, '.env')
  const env = {}
  if (!fs.existsSync(envPath)) return env
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return env
}

export function resolveTarget(p) {
  const expanded = p === '~' ? os.homedir() : p.replace(/^~[\\/]/, os.homedir() + path.sep)
  return path.resolve(rootDir, expanded)
}

export function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    return e.isDirectory() ? listFiles(full, base) : [path.relative(base, full)]
  }).sort()
}

// Content hash and newest mtime of a skill folder.
export function fingerprint(dir) {
  const hash = crypto.createHash('sha1')
  let newest = 0
  for (const rel of listFiles(dir)) {
    const full = path.join(dir, rel)
    hash.update(rel.replace(/\\/g, '/')).update(fs.readFileSync(full))
    newest = Math.max(newest, fs.statSync(full).mtimeMs)
  }
  return { hash: hash.digest('hex'), newest }
}

export function findSkills() {
  const pluginsDir = path.join(rootDir, 'plugins')
  const skills = []
  if (!fs.existsSync(pluginsDir)) return skills
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

export function syncSkills({ targets, force = false, dryRun = false }) {
  const resolvedTargets = targets.map((t) => typeof t === 'string' ? resolveTarget(t) : t)
  const skills = findSkills()
  const counts = { copied: 0, same: 0, skipped: 0 }

  console.log(`${dryRun ? '[dry run] ' : ''}Syncing ${skills.length} skill(s) to ${resolvedTargets.length} target(s)\n`)

  for (const target of resolvedTargets) {
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
  return counts
}

// Run directly if invoked via CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const force = process.argv.includes('--force')
  const dryRun = process.argv.includes('--dry-run')
  const env = loadEnv()
  const rawTargets = (env.SKILL_TARGETS || DEFAULT_TARGETS).split(',').map((t) => t.trim()).filter(Boolean)
  const counts = syncSkills({ targets: rawTargets, force, dryRun })
  process.exit(counts.skipped ? 1 : 0)
}