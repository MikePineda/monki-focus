// SPDX-License-Identifier: AGPL-3.0-or-later
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FIXTURE_KINDS, packageRoot } from '@monki-focus/rules'
import { KINDS_RUN_ELSEWHERE, RUNNER_KINDS } from './FixtureRunner.ts'

const elsewhere = new Set<string>(KINDS_RUN_ELSEWHERE)

describe('fixture runner coverage', () => {
  it('runs_every_non_analytics_fixture_kind_the_rules_package_declares', () => {
    const declared = FIXTURE_KINDS.filter((kind) => !elsewhere.has(kind))
    expect([...RUNNER_KINDS].sort()).toEqual([...declared].sort())
  })

  it('runs_every_non_analytics_fixture_directory_that_exists', () => {
    const fixturesRoot = join(packageRoot, 'fixtures')
    const directories = readdirSync(fixturesRoot)
      .filter((name) => statSync(join(fixturesRoot, name)).isDirectory())
      .filter((name) => !elsewhere.has(name))
    expect([...RUNNER_KINDS].sort()).toEqual(directories.sort())
  })
})
