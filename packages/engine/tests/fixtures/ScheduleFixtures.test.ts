// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect } from 'vitest'
import { bedtimePhase, isScheduleActive } from '../../src/index.ts'
import { describeFixtures } from './FixtureRunner.ts'

describeFixtures('schedule', (fixture) => {
  if ('bedtime' in fixture.given) {
    const { bedtime, now, timeZone } = fixture.given
    expect({ phase: bedtimePhase(bedtime, now, timeZone) }).toEqual(fixture.then)
  } else {
    const { schedules, workHours, now, timeZone } = fixture.given
    expect({ active: isScheduleActive(schedules, workHours, now, timeZone) }).toEqual(fixture.then)
  }
})
