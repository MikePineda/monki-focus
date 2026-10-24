// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { fixedClock, systemClock } from '../../../src/shared/clock'

describe('Clock', () => {
  it('fixed_clock_always_answers_the_given_instant', () => {
    const clock = fixedClock('2026-01-05T09:00:00Z')
    expect(clock.now()).toBe(Date.UTC(2026, 0, 5, 9))
    expect(clock.now()).toBe(clock.now())
    expect(clock.monotonic()).toBe(0)
  })

  it('fixed_clock_rejects_an_invalid_instant', () => {
    expect(() => fixedClock('not a date')).toThrow(RangeError)
  })

  it('system_clock_monotonic_time_never_goes_backwards', () => {
    const first = systemClock.monotonic()
    expect(systemClock.monotonic()).toBeGreaterThanOrEqual(first)
  })
})
