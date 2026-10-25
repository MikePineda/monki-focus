// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { join, relative } from 'node:path'
import app from '@adonisjs/core/services/app'
import { readdir, readFile } from 'node:fs/promises'

/**
 * Domain modules (app/domain) are pure: decision, escalation, analytics,
 * token verification and policy logic take the clock and every input as
 * parameters. No framework, no database, no network or file system, no
 * implicit "now". Platform code is a thin adapter around them.
 */
const FORBIDDEN_IMPORTS: Array<[RegExp, string]> = [
  [/^@adonisjs\//, 'framework (AdonisJS)'],
  [/^@vinejs\//, 'framework validation (VineJS)'],
  [/^(pg|knex|luxon)$/, 'database driver or clock library'],
  [
    /^#(models|services|controllers|middleware|database|start|config|providers|scheduler|http|logging|exceptions)\//,
    'application layer',
  ],
  [/^node:(fs|net|http|https|child_process|dgram|dns|tls)(\/|$)/, 'I/O module'],
]

/** Reading the wall clock inside the domain (`Date.now()`, `new Date()`). */
const IMPLICIT_NOW = /\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\bperformance\.now\s*\(/

const IMPORT_SPECIFIER =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g

async function sourceFiles(dir: string): Promise<string[]> {
  const found: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...(await sourceFiles(path)))
    else if (/\.ts$/.test(entry.name)) found.push(path)
  }
  return found
}

function importsOf(source: string): string[] {
  return [...source.matchAll(IMPORT_SPECIFIER)].map((match) => match[1] ?? match[2] ?? match[3])
}

test.group('Architecture', () => {
  test('test_domain_modules_have_no_framework_or_io_imports', async ({ assert }) => {
    const files = await sourceFiles(app.makePath('app/domain'))
    assert.isAbove(files.length, 0, 'app/domain has modules')

    const violations: string[] = []
    for (const file of files) {
      for (const specifier of importsOf(await readFile(file, 'utf8'))) {
        for (const [pattern, why] of FORBIDDEN_IMPORTS) {
          if (pattern.test(specifier)) {
            violations.push(`${relative(app.makePath(), file)} imports ${specifier} (${why})`)
          }
        }
      }
    }

    assert.deepEqual(violations, [])
  })

  test('test_domain_modules_never_read_the_clock', async ({ assert }) => {
    const violations: string[] = []
    for (const file of await sourceFiles(app.makePath('app/domain'))) {
      if (IMPLICIT_NOW.test(await readFile(file, 'utf8'))) {
        violations.push(relative(app.makePath(), file))
      }
    }

    assert.deepEqual(violations, [])
  })

  test('test_the_import_scanner_catches_every_import_form', ({ assert }) => {
    const source = [
      `import db from '@adonisjs/lucid/services/db'`,
      `import type { X } from "#models/user"`,
      `export { y } from 'pg'`,
      `const lazy = await import('node:fs/promises')`,
      `import 'reflect-metadata'`,
    ].join('\n')

    assert.deepEqual(importsOf(source), [
      '@adonisjs/lucid/services/db',
      '#models/user',
      'pg',
      'node:fs/promises',
      'reflect-metadata',
    ])
  })

  test('test_no_utils_helpers_common_or_misc_files', async ({ assert }) => {
    const files = await sourceFiles(app.makePath('app'))
    const offenders = files
      .map((file) => relative(app.makePath(), file))
      .filter((file) => /(^|\/)(utils?|helpers?|common|misc)(\.ts$|\/)/.test(file))

    assert.deepEqual(offenders, [])
  })
})
