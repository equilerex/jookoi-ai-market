import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

import { rootDir, syncSkills } from '../scripts/sync-skills.mjs'

test('sync refuses project skill targets before copying', () => {
  const projectSkills = path.resolve(rootDir, '..', 'another-project', '.agents', 'skills')
  assert.throws(
    () => syncSkills({ targets: [projectSkills], dryRun: true }),
    /Only global skill targets are supported/,
  )
})
