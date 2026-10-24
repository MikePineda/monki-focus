// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { findEvalUses } from '../../../config/bundleEvalCheck'

describe('bundleEvalCheck', () => {
  let dir: string | undefined

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('finds_every_form_of_run_time_code_generation_in_any_file', () => {
    dir = mkdtempSync(join(tmpdir(), 'bundle-'))
    mkdirSync(join(dir, 'chunks'))
    writeFileSync(join(dir, 'clean.js'), 'const fn = () => functionName(1)')
    writeFileSync(join(dir, 'chunks', 'a.js'), 'let i=Function(`a`,`b`)')
    writeFileSync(join(dir, 'chunks', 'b.js'), 'x = new Function("return 1")')
    writeFileSync(join(dir, 'c.html'), '<script>eval("1")</script>')

    expect(findEvalUses(dir).sort()).toEqual([
      'c.html: eval(',
      'chunks/a.js: Function(',
      'chunks/b.js: new Function',
    ])
  })

  it('every_build_script_runs_the_check', () => {
    const { scripts } = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../../package.json'), 'utf8')
    ) as { scripts: Record<string, string> }

    for (const name of ['build', 'build:dev', 'build:e2e', 'zip']) {
      expect(scripts[name]).toContain('node config/bundleEvalCheck.ts')
    }
  })
})
