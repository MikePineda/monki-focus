// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { loadFixtures } from '@monki-focus/rules'
import type { FixtureByKind } from '@monki-focus/rules'

/**
 * Fixture kinds this package runs: every kind of packages/rules except the
 * analytics kind (`activity`, @monki-focus/analytics) and `unlock-token`
 * (vectors live in packages/protocol). A new kind fails RunnerCoverage.test.ts.
 */
export const RUNNER_KINDS = [
  'decision',
  'specificity',
  'url-normalize',
  'schedule',
  'escalation',
  'rule-change',
  'candidates',
  'invalid',
] as const

export type RunnerKind = (typeof RUNNER_KINDS)[number]

/** Kinds that other packages run. */
export const KINDS_RUN_ELSEWHERE = ['activity', 'unlock-token'] as const

/**
 * One test per fixture, named exactly after the fixture id. Nothing is skipped:
 * `knownFailures` (at most three, each with a FIXME(rules) comment at the call
 * site) runs as `it.fails`, so a fixed fixture turns the suite red again.
 */
export function describeFixtures<K extends RunnerKind>(
  kind: K,
  check: (fixture: FixtureByKind[K]) => void,
  knownFailures: ReadonlySet<string> = new Set()
): void {
  const fixtures = loadFixtures(kind)
  describe(`${kind} fixtures`, () => {
    it('has_at_least_one_fixture', () => {
      expect(fixtures.length).toBeGreaterThan(0)
    })
    for (const fixture of fixtures) {
      const test = knownFailures.has(fixture.id) ? it.fails : it
      test(fixture.id, () => {
        check(fixture)
      })
    }
  })
}
