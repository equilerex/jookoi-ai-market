#!/usr/bin/env node
// Interactive setup and sync script.
// Lets you select which global skill folders receive copies of marketplace skills.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { rootDir, loadEnv, syncSkills } from './sync-skills.mjs'

const env = loadEnv()
const existingConfigTargets = env.SKILL_TARGETS
  ? env.SKILL_TARGETS.split(',').map((t) => t.trim()).filter(Boolean)
  : null

function toPortablePath(absOrRelPath) {
  const home = os.homedir()
  const resolved = path.resolve(rootDir, absOrRelPath.replace(/^~[\\/]/, home + path.sep))
  if (resolved.startsWith(home)) {
    return '~' + resolved.slice(home.length).replace(/\\/g, '/')
  }
  const rel = path.relative(rootDir, resolved).replace(/\\/g, '/')
  return rel.startsWith('.') ? rel : `./${rel}`
}

function discoverCandidates() {
  const candidates = []
  const seenPaths = new Set()

  function addCandidate(rawPath, label, defaultChecked = false) {
    const portable = toPortablePath(rawPath)
    if (seenPaths.has(portable)) return
    seenPaths.add(portable)

    let checked = defaultChecked
    if (existingConfigTargets) {
      checked = existingConfigTargets.some((t) => toPortablePath(t) === portable)
    }

    candidates.push({
      label,
      rawPath,
      portable,
      checked
    })
  }

  // 1. Universal / open agent standard
  addCandidate('~/.agents/skills', 'Global universal (~/.agents/skills)', true)

  // 2. Claude personal skills
  addCandidate('~/.claude/skills', 'Global Claude (~/.claude/skills)', true)

  return candidates
}

function saveEnvTargets(targets) {
  const envPath = path.join(rootDir, '.env')
  const val = targets.map((t) => t.portable).join(',')
  let content = ''

  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
    let found = false
    const newLines = lines.map((line) => {
      if (line.match(/^\s*SKILL_TARGETS\s*=/)) {
        found = true
        return `SKILL_TARGETS=${val}`
      }
      return line
    })
    if (!found) {
      newLines.push(`SKILL_TARGETS=${val}`)
    }
    content = newLines.join('\n')
  } else {
    content = `# Read by npm run sync and npm start\nSKILL_TARGETS=${val}\n`
  }

  fs.writeFileSync(envPath, content, 'utf8')
}

async function runInteractive(candidates) {
  let cursor = 0

  function render() {
    process.stdout.write('\x1b[2J\x1b[0;0H') // Clear screen
    console.log('\x1b[1m=== JooKoi AI Market — Skill Sync Setup ===\x1b[0m')
    console.log('Select where skills should be copied:\n')

    candidates.forEach((c, idx) => {
      const pointer = idx === cursor ? '\x1b[36m>\x1b[0m' : ' '
      const checkbox = c.checked ? '\x1b[32m[x]\x1b[0m' : '[ ]'
      const label = idx === cursor ? `\x1b[36m${c.label}\x1b[0m` : c.label
      const pathHint = `\x1b[90m(${c.portable})\x1b[0m`
      console.log(` ${pointer} ${checkbox} ${label} ${pathHint}`)
    })

    console.log('\n\x1b[90mControls: [↑/↓] Navigate  [Space] Toggle  [a] Toggle all  [Enter] Confirm & Sync  [q] Quit\x1b[0m')
  }

  readline.emitKeypressEvents(process.stdin)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
  }

  render()

  return new Promise((resolve) => {
    async function onKeypress(str, key) {
      if (key.ctrl && key.name === 'c' || key.name === 'q') {
        cleanup()
        console.log('\nAborted.')
        process.exit(0)
      }

      if (key.name === 'up' || key.name === 'k') {
        cursor = (cursor - 1 + candidates.length) % candidates.length
        render()
      } else if (key.name === 'down' || key.name === 'j') {
        cursor = (cursor + 1) % candidates.length
        render()
      } else if (key.name === 'space') {
        candidates[cursor].checked = !candidates[cursor].checked
        render()
      } else if (str === 'a' || str === 'A') {
        const anyUnchecked = candidates.some((c) => !c.checked)
        candidates.forEach((c) => { c.checked = anyUnchecked })
        render()
      } else if (key.name === 'return' || key.name === 'enter') {
        cleanup()
        resolve(candidates.filter((c) => c.checked))
      }
    }

    function cleanup() {
      process.stdin.removeListener('keypress', onKeypress)
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false)
      }
    }

    process.stdin.on('keypress', onKeypress)
  })
}

async function runNonInteractive(candidates) {
  console.log('=== JooKoi AI Market — Skill Sync Setup ===')
  const selected = candidates.filter((c) => c.checked)
  if (selected.length === 0) {
    selected.push(candidates[0])
  }
  return selected
}

async function main() {
  const candidates = discoverCandidates()
  let selected = []

  if (process.stdin.isTTY && !process.argv.includes('--non-interactive')) {
    selected = await runInteractive(candidates)
  } else {
    selected = await runNonInteractive(candidates)
  }

  if (selected.length === 0) {
    console.log('\nNo targets selected. Nothing copied.')
    process.exit(0)
  }

  console.log(`\nSaving ${selected.length} target(s) to .env...`)
  saveEnvTargets(selected)

  console.log('Running sync...\n')
  const targetPaths = selected.map((s) => s.portable)
  const counts = syncSkills({ targets: targetPaths, force: process.argv.includes('--force') })

  console.log('\nSetup complete. Run `npm run sync` anytime to update skills to these targets.')
  process.exit(counts.skipped ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
