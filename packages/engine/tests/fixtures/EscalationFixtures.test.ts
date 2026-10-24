// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect } from 'vitest'
import { nextEscalation } from '../../src/index.ts'
import { describeFixtures } from './FixtureRunner.ts'

describeFixtures('escalation', (fixture) => {
  let state = fixture.given.state
  fixture.steps.forEach((step, index) => {
    const result = nextEscalation(state, step.event, step.at, fixture.given.guardianLinked)
    expect(result, `step ${index} (${step.event.type} at ${step.at})`).toEqual(step.then)
    state = result.state
  })
})
