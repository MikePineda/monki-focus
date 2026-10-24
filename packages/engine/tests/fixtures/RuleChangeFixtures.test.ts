// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect } from 'vitest'
import type { Ruleset } from '@monki-focus/rules'
import { effectiveRuleSet } from '../../src/index.ts'
import { fixtureCatalog } from './FixtureCatalog.ts'
import { describeFixtures } from './FixtureRunner.ts'

/** SEMANTICS.md §8: runners compare rules as a set keyed by id. */
function rulesAsSet(ruleset: Ruleset): Ruleset {
  return { ...ruleset, rules: [...ruleset.rules].sort((a, b) => (a.id < b.id ? -1 : 1)) }
}

describeFixtures('rule-change', (fixture) => {
  const { old, new: next, now, pendingEffectiveFrom } = fixture.given
  const result = effectiveRuleSet(old, next, now, pendingEffectiveFrom, fixtureCatalog())
  expect(result.effectiveFrom).toBe(fixture.then.effectiveFrom)
  expect(rulesAsSet(result.effectiveToday)).toEqual(rulesAsSet(fixture.then.effectiveToday))
})
