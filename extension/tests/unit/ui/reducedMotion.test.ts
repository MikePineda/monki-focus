// SPDX-License-Identifier: AGPL-3.0-or-later
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const UI = resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/ui')
const MOTION_QUERY = /@media\s*\(prefers-reduced-motion:\s*(no-preference|reduce)\)\s*\{/g

/** The CSS with every `prefers-reduced-motion` block (balanced braces) cut out. */
function withoutMotionQueries(css: string): string {
  let result = ''
  let cursor = 0
  for (const match of css.matchAll(MOTION_QUERY)) {
    if (match.index < cursor) continue
    result += css.slice(cursor, match.index)
    let depth = 1
    let index = match.index + match[0].length
    while (depth > 0 && index < css.length) {
      if (css[index] === '{') depth += 1
      if (css[index] === '}') depth -= 1
      index += 1
    }
    cursor = index
  }
  return result + css.slice(cursor)
}

describe('motion', () => {
  it('ui_motion_only_runs_behind_a_reduced_motion_query', () => {
    const files = readdirSync(UI).filter((name) => name.endsWith('.css'))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const outside = withoutMotionQueries(readFileSync(join(UI, file), 'utf8'))
      expect(outside, file).not.toMatch(/\b(transition|animation)\s*:/)
    }
  })
})
