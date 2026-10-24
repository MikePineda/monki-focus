// SPDX-License-Identifier: AGPL-3.0-or-later
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Run-time code generation the MV3 content security policy forbids (and
 * that would mean Ajv's compiler shipped): `Function(`, `new Function` and
 * `eval(` anywhere in a built file.
 */
export const EVAL_PATTERN = /\bnew Function\b|\bFunction\(|\beval\(/

/** Every `path:pattern` hit under `dir` (all files, any type). */
export function findEvalUses(dir: string): string[] {
  const hits: string[] = []
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      const match = EVAL_PATTERN.exec(readFileSync(path, 'latin1'))
      if (match) hits.push(`${relative(dir, path)}: ${match[0]}`)
    }
  }
  walk(dir)
  return hits
}

// `node config/bundleEvalCheck.ts <dir>` (run after every build): fails on any hit.
if (import.meta.main) {
  const dir = process.argv[2] ?? '.output/chrome-mv3'
  const hits = findEvalUses(dir)
  if (hits.length > 0) {
    console.error(`Run-time code generation in ${dir}:\n${hits.join('\n')}`)
    process.exit(1)
  }
  console.log(`bundle-eval-check: ${dir} has no Function(, new Function or eval(`)
}
