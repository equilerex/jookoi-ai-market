#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const ALLOWED_FIELDS = new Set(['name', 'description', 'license', 'compatibility', 'metadata'])
const RESERVED_WORDS = ['claude', 'anthropic']
const NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/

function parseArgs() {
  const args = process.argv.slice(2)
  const launchIdx = args.indexOf('--launch')
  const promptIdx = args.indexOf('--prompt')
  const fixMetadata = args.includes('--fix-metadata')
  const runClaudeValidate = args.includes('--validate-plugin')

  let launchAgent = null
  if (launchIdx !== -1 && args[launchIdx + 1]) {
    launchAgent = args[launchIdx + 1]
  }

  const printPrompt = promptIdx !== -1 || (launchIdx !== -1 && !launchAgent)
  return { launchAgent, printPrompt, fixMetadata, runClaudeValidate }
}

function parseYamlFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return { raw: null, fields: {}, unrecognized: [] }
  const rawYaml = match[1]
  const fields = {}
  const lines = rawYaml.split(/\r?\n/)
  let currentKey = null
  let currentObj = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim() || line.trim().startsWith('#')) continue

    // Indented line under an object (e.g. metadata)
    const indentMatch = line.match(/^ {2,4}([a-zA-Z0-9_-]+):\s*(.*)$/)
    if (indentMatch && currentKey && currentObj) {
      const subKey = indentMatch[1].trim()
      const subVal = indentMatch[2].trim().replace(/^['"]|['"]$/g, '')
      currentObj[subKey] = subVal
      continue
    }

    // Top-level key
    const topMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/)
    if (topMatch) {
      const key = topMatch[1].trim()
      let val = topMatch[2].trim()

      if (val === '' && i + 1 < lines.length && lines[i + 1].startsWith('  ')) {
        // Start of object block (like metadata:)
        currentKey = key
        currentObj = {}
        fields[key] = currentObj
      } else {
        currentKey = key
        currentObj = null
        // Check for multiline string continuation
        let fullVal = val
        let nextIdx = i + 1
        while (nextIdx < lines.length && /^\s+/.test(lines[nextIdx]) && !lines[nextIdx].match(/^\s+[a-zA-Z0-9_-]+:/)) {
          fullVal += ' ' + lines[nextIdx].trim()
          i = nextIdx
          nextIdx++
        }
        fields[key] = fullVal.replace(/^['"]|['"]$/g, '')
      }
    }
  }

  const unrecognized = Object.keys(fields).filter((k) => !ALLOWED_FIELDS.has(k))
  return { raw: rawYaml, fields, unrecognized }
}

function loadRepoConfig() {
  const pkgPath = path.join(rootDir, 'package.json')
  const marketPath = path.join(rootDir, '.claude-plugin', 'marketplace.json')
  const agentsPath = path.join(rootDir, 'AGENTS.md')

  const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : {}
  const market = fs.existsSync(marketPath) ? JSON.parse(fs.readFileSync(marketPath, 'utf8')) : {}
  const agents = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, 'utf8') : ''

  let prefix = pkg.skillPrefix
  if (!prefix && agents) {
    const prefixMatch = agents.match(/prefix[^\n`"]*[`"]([a-z0-9]+-)[`"]/i)
    if (prefixMatch) prefix = prefixMatch[1]
  }
  if (!prefix) prefix = 'jookoi-'

  const author = pkg.author || (market.owner ? market.owner.name : 'Author')
  const repository = pkg.repository?.url || (market.name ? `https://github.com/equilerex/${market.name}` : '')

  return { prefix, author, repository }
}

function validateSkillMetadata(skillName, dirName, frontmatter, repoConfig) {
  const issues = []
  const { fields, unrecognized } = frontmatter
  const { prefix } = repoConfig

  // Directory name checks
  if (dirName.toLowerCase() === 'synced') {
    issues.push('Directory name "synced" is reserved and forbidden')
  }

  // Name validation
  const name = fields.name
  if (!name) {
    issues.push('Missing required frontmatter field: name')
  } else {
    if (name.length < 1 || name.length > 64) {
      issues.push(`Field name length (${name.length}) violates limit (1-64 characters)`)
    }
    if (!NAME_REGEX.test(name)) {
      issues.push(`Field name "${name}" violates format ^[a-z0-9]+(-[a-z0-9]+)*$ (lowercase alphanumeric with single hyphens)`)
    }
    if (name !== dirName) {
      issues.push(`Field name "${name}" does not match directory name "${dirName}"`)
    }
    if (name.startsWith('-') || name.endsWith('-') || name.includes('--')) {
      issues.push(`Field name "${name}" contains leading, trailing, or consecutive hyphens`)
    }
    for (const reserved of RESERVED_WORDS) {
      if (name.toLowerCase().includes(reserved)) {
        issues.push(`Field name "${name}" contains forbidden reserved term: "${reserved}"`)
      }
    }
    if (/[<>]/.test(name)) {
      issues.push(`Field name "${name}" contains forbidden XML/HTML brackets (< or >)`)
    }
    if (prefix && !name.startsWith(prefix)) {
      issues.push(`Authored skill name "${name}" does not use configured "${prefix}" prefix`)
    }
  }

  // Description validation
  const desc = fields.description
  if (!desc || desc.trim() === '') {
    issues.push('Missing required frontmatter field: description')
  } else {
    if (desc.length < 1 || desc.length > 1024) {
      issues.push(`Field description length (${desc.length}) violates limit (1-1024 characters)`)
    }
    if (/[<>]/.test(desc)) {
      issues.push('Field description contains forbidden XML/HTML brackets (< or >)')
    }
  }

  // Compatibility validation
  if (fields.compatibility && fields.compatibility.length > 500) {
    issues.push(`Field compatibility length (${fields.compatibility.length}) violates limit (max 500 characters)`)
  }

  // Unrecognized top-level fields
  if (unrecognized.length > 0) {
    issues.push(`Unrecognized top-level frontmatter fields: ${unrecognized.join(', ')}`)
  }

  // Metadata block check (for credit and author provenance)
  const meta = fields.metadata
  if (!meta || typeof meta !== 'object') {
    issues.push('Missing metadata map (recommended for credit: author, repository, and last_updated)')
  } else {
    if (!meta.author) {
      issues.push('metadata missing "author" credit field')
    }
    if (!meta.repository) {
      issues.push('metadata missing "repository" link field')
    }
    if (!meta.last_updated && !meta.updated && !meta.date) {
      issues.push('metadata missing "last_updated" timestamp field')
    }
  }

  return issues
}

function applyMetadataPatch(skillMdPath, currentFields, repoConfig) {
  const content = fs.readFileSync(skillMdPath, 'utf8')
  if (!content.startsWith('---')) return

  const today = new Date().toISOString().slice(0, 10)

  if (content.includes('metadata:')) {
    const meta = currentFields.metadata || {}
    if (!meta.last_updated && !meta.updated && !meta.date) {
      const updated = content.replace(/(metadata:\r?\n)/, `$1  last_updated: ${today}\n`)
      fs.writeFileSync(skillMdPath, updated, 'utf8')
      console.log(`Added last_updated timestamp in ${path.relative(rootDir, skillMdPath)}`)
    }
    return
  }

  const metaBlock = [
    'metadata:',
    `  author: ${repoConfig.author}`,
    `  repository: ${repoConfig.repository}`,
    `  last_updated: ${today}`
  ].join('\n')

  // Insert before the closing --- of frontmatter
  const closingIdx = content.indexOf('\n---', 3)
  if (closingIdx === -1) return

  const updated = content.slice(0, closingIdx) + '\n' + metaBlock + content.slice(closingIdx)
  fs.writeFileSync(skillMdPath, updated, 'utf8')
  console.log(`Updated metadata credit in ${path.relative(rootDir, skillMdPath)}`)
}

function auditMarketplace(options = {}) {
  const pluginsDir = path.join(rootDir, 'plugins')
  const readmePath = path.join(rootDir, 'README.md')
  const archPath = path.join(rootDir, '_architecture', 'ARCHITECTURE.md')

  const readmeContent = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : ''
  const archContent = fs.existsSync(archPath) ? fs.readFileSync(archPath, 'utf8') : ''

  const plugins = fs.readdirSync(pluginsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

  const repoConfig = loadRepoConfig()
  const missingReport = []

  for (const pluginName of plugins) {
    const pluginDir = path.join(pluginsDir, pluginName)
    const skillsDir = path.join(pluginDir, 'skills')
    const pluginJsonPath = path.join(pluginDir, '.claude-plugin', 'plugin.json')

    const pluginJson = fs.existsSync(pluginJsonPath)
      ? JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'))
      : null

    if (!fs.existsSync(skillsDir)) continue

    const skillFolders = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)

    for (const skillName of skillFolders) {
      const skillPath = path.join(skillsDir, skillName)
      const skillMdPath = path.join(skillPath, 'SKILL.md')
      const issues = []

      if (!fs.existsSync(skillMdPath)) {
        issues.push('Missing SKILL.md')
        missingReport.push({ plugin: pluginName, skill: skillName, issues })
        continue
      }

      const skillContent = fs.readFileSync(skillMdPath, 'utf8')
      const frontmatter = parseYamlFrontmatter(skillContent)

      // Strict metadata rules check
      const metadataIssues = validateSkillMetadata(skillName, skillName, frontmatter, repoConfig)

      if (options.fixMetadata && metadataIssues.some((i) => i.includes('metadata'))) {
        applyMetadataPatch(skillMdPath, frontmatter.fields, repoConfig)
      } else {
        issues.push(...metadataIssues)
      }

      // Check README table
      const inReadmeTable = readmeContent.includes(`[\`${skillName}\`]`)
      if (!inReadmeTable) {
        issues.push('README.md: missing from Skills table')
      }

      // Check README structure tree
      const inReadmeStructure = readmeContent.includes(`${skillName}/`)
      if (!inReadmeStructure) {
        issues.push('README.md: missing from Structure directory tree')
      }

      // Check README Gemini install command
      const inReadmeGemini = readmeContent.includes(`--path plugins/${pluginName}/skills/${skillName}`)
      if (!inReadmeGemini) {
        issues.push('README.md: missing from Gemini CLI install commands')
      }

      // Check ARCHITECTURE.md
      const inArch = archContent.includes(skillName)
      if (!inArch) {
        issues.push('_architecture/ARCHITECTURE.md: missing from layout section')
      }

      // Check plugin.json keyword or description
      if (pluginJson) {
        const textToSearch = `${pluginJson.description || ''} ${(pluginJson.keywords || []).join(' ')}`.toLowerCase()
        const shortName = skillName.replace(/^jookoi-/, '').toLowerCase()
        const tokens = shortName.split('-').filter((t) => t.length > 2 && t !== 'code')
        const exactMatch = textToSearch.includes(skillName.toLowerCase()) || textToSearch.includes(shortName)
        const tokenMatch = tokens.length > 0 && tokens.some((t) => {
          const stem = t.slice(0, 4)
          return textToSearch.includes(t) || textToSearch.includes(stem)
        })

        if (!exactMatch && !tokenMatch) {
          issues.push('plugin.json: not represented in description or keywords')
        }
      }

      if (issues.length > 0) {
        missingReport.push({
          plugin: pluginName,
          skill: skillName,
          description: frontmatter.fields.description || '',
          issues
        })
      }
    }
  }

  return missingReport
}

function buildPrompt(missingReport) {
  let prompt = 'Please update the repository references for the following skills:\n\n'
  for (const item of missingReport) {
    prompt += `Skill: ${item.skill} (Plugin: ${item.plugin})\n`
    if (item.description) {
      prompt += `Description: ${item.description}\n`
    }
    prompt += 'Validation issues / missing references:\n'
    for (const issue of item.issues) {
      prompt += ` - ${issue}\n`
    }
    prompt += '\n'
  }
  prompt += 'Files to verify:\n'
  prompt += '- SKILL.md: ensure frontmatter adheres to Anthropic Claude Code limits (name <= 64 chars, description <= 1024 chars, no XML tags, jookoi- prefix, metadata author/repository)\n'
  prompt += '- README.md: Skills table row, Structure tree, Gemini install command\n'
  prompt += '- plugins/<plugin>/.claude-plugin/plugin.json: version bump, description/keywords\n'
  prompt += '- _architecture/ARCHITECTURE.md: skills list in Layout section\n'
  return prompt
}

function launch(command, promptText) {
  console.log(`\nLaunching ${command} with prompt:\n`)
  console.log(promptText)

  let args = []
  if (command === 'claude') {
    args = [promptText]
  } else if (command === 'agy') {
    args = ['-i', promptText]
  } else {
    args = [promptText]
  }

  const child = spawn(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true
  })

  child.on('exit', (code) => {
    process.exit(code || 0)
  })
}

function runClaudeValidation() {
  console.log('Running native Claude plugin validations...\n')
  const pluginsDir = path.join(rootDir, 'plugins')
  const plugins = fs.readdirSync(pluginsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

  let allPassed = true
  for (const plugin of plugins) {
    const target = path.join('plugins', plugin)
    console.log(`> claude plugin validate ${target}`)
    const res = spawnSync('claude', ['plugin', 'validate', target], { cwd: rootDir, stdio: 'inherit', shell: true })
    if (res.status !== 0) allPassed = false
  }

  console.log('> claude plugin validate .')
  const rootRes = spawnSync('claude', ['plugin', 'validate', '.'], { cwd: rootDir, stdio: 'inherit', shell: true })
  if (rootRes.status !== 0) allPassed = false

  return allPassed
}

function main() {
  const { launchAgent, printPrompt, fixMetadata, runClaudeValidate } = parseArgs()

  if (runClaudeValidate) {
    const passed = runClaudeValidation()
    if (!passed) process.exit(1)
  }

  const missingReport = auditMarketplace({ fixMetadata })

  if (missingReport.length === 0) {
    console.log('All skills comply with Anthropic metadata constraints and are fully referenced across README.md, plugin.json, and ARCHITECTURE.md.')
    process.exit(0)
  }

  console.log(`Found issues across ${missingReport.length} skill(s):\n`)
  for (const item of missingReport) {
    console.log(`[${item.skill}] in ${item.plugin}:`)
    for (const issue of item.issues) {
      console.log(`  - ${issue}`)
    }
    console.log()
  }

  const promptText = buildPrompt(missingReport)

  if (launchAgent) {
    launch(launchAgent, promptText)
    return
  }

  if (printPrompt) {
    console.log('--- Suggested Agent Prompt ---')
    console.log(promptText)
    console.log('------------------------------')
  } else {
    console.log('Options:')
    console.log('  --fix-metadata        Auto-insert metadata credit block (author, repository) into SKILL.md')
    console.log('  --validate-plugin     Run native claude plugin validate on manifests')
    console.log('  --prompt              Print agent prompt to fix issues')
    console.log('  --launch claude|agy   Boot up agent with pre-composed prompt')
  }

  process.exit(1)
}

main()
