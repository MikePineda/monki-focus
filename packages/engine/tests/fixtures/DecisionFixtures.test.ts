// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect } from 'vitest'
import type { DecisionFixture } from '@monki-focus/rules'
import { decide } from '../../src/index.ts'
import { fixtureCatalog } from './FixtureCatalog.ts'
import { describeFixtures } from './FixtureRunner.ts'

function checkDecision(fixture: DecisionFixture): void {
  const { ruleset, state, now } = fixture.given
  expect(decide(ruleset, fixture.when.target, state, now, fixtureCatalog())).toEqual(fixture.then)
}

describeFixtures('decision', checkDecision)
describeFixtures('specificity', checkDecision)
