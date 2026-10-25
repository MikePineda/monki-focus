// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { VALIDITY_ALARM, ValidityAlarm } from '../../../../src/background/decisions/ValidityAlarm'
import { ManualClock } from '../../../support/ManualClock'

/** Alarms on a browser clock 1 000 000 ms behind the decisions' clock (an e2e offset). */
function fakeAlarms() {
  const scheduled = new Map<string, number>()
  const created: number[] = []
  return {
    scheduled,
    created,
    api: {
      create(name: string, info: { when: number }) {
        scheduled.set(name, info.when)
        created.push(info.when)
      },
      get(name: string) {
        const when = scheduled.get(name)
        return Promise.resolve(when === undefined ? undefined : { scheduledTime: when })
      },
    },
  }
}

const SYSTEM_NOW = 1_000

function makeAlarm(alarms = fakeAlarms(), clock = new ManualClock('2026-01-05T09:00:00Z')) {
  return { alarm: new ValidityAlarm(alarms.api, clock, () => SYSTEM_NOW), alarms, clock }
}

describe('ValidityAlarm', () => {
  it('the_alarm_rings_at_the_earliest_validity_on_the_browser_clock', async () => {
    const { alarm, alarms } = makeAlarm()

    await alarm.offer('2026-01-05T10:00:00Z')
    await alarm.offer('2026-01-05T09:30:00Z')
    await alarm.offer('2026-01-05T11:00:00Z')

    expect(alarms.scheduled.get(VALIDITY_ALARM)).toBe(SYSTEM_NOW + 30 * 60_000)
    expect(alarms.created).toEqual([SYSTEM_NOW + 60 * 60_000, SYSTEM_NOW + 30 * 60_000])
  })

  it('an_engine_error_or_a_past_instant_schedules_nothing', async () => {
    const { alarm, alarms } = makeAlarm()

    await alarm.offer(null)
    await alarm.offer('2026-01-05T08:00:00Z')

    expect(alarms.created).toEqual([])
  })

  it('after_it_rang_the_next_decision_schedules_the_next_alarm', async () => {
    const { alarm, alarms, clock } = makeAlarm()
    await alarm.offer('2026-01-05T09:30:00Z')
    clock.set('2026-01-05T09:30:00Z')

    alarm.rang()
    await alarm.offer('2026-01-05T12:00:00Z')

    expect(alarms.created.at(-1)).toBe(SYSTEM_NOW + 150 * 60_000)
  })

  it('a_restarted_worker_keeps_an_earlier_alarm_already_scheduled', async () => {
    const alarms = fakeAlarms()
    await makeAlarm(alarms).alarm.offer('2026-01-05T09:30:00Z')

    const { alarm } = makeAlarm(alarms)
    await alarm.offer('2026-01-05T11:00:00Z')

    expect(alarms.created).toEqual([SYSTEM_NOW + 30 * 60_000])
  })

  it('a_failing_alarms_api_never_rejects', async () => {
    const clock = new ManualClock('2026-01-05T09:00:00Z')
    const alarm = new ValidityAlarm(
      {
        create: () => Promise.reject(new Error('alarms')),
        get: () => Promise.reject(new Error('alarms')),
      },
      clock
    )

    await expect(alarm.offer('2026-01-05T10:00:00Z')).resolves.toBeUndefined()
  })
})
