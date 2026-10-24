// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect } from 'vitest'
import { budgetedRulesFor, frictionCandidates } from '../../src/index.ts'
import { fixtureCatalog } from './FixtureCatalog.ts'
import { describeFixtures } from './FixtureRunner.ts'

describeFixtures('candidates', (fixture) => {
  const { ruleset, now } = fixture.given
  const observation = fixture.when.target
  expect({
    frictionCandidates: frictionCandidates(ruleset, observation, now, fixtureCatalog()),
    budgetedRules: budgetedRulesFor(ruleset, observation, now, fixtureCatalog()),
  }).toEqual(fixture.then)
})
