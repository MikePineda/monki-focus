// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { dailyTotals, localDateOf, nextLocalMidnight } from '../../src/index.ts'
import { epochSecondsOf, utcInstantOf } from '../../src/Instant.ts'

describe('DailyTotals', () => {
  it('zero_length_entries_add_no_date', () => {
    expect(
      dailyTotals([{ timestamp: '2026-10-26T09:00:00Z', duration: 0, level: 50 }], 'UTC')
    ).toStrictEqual([])
  })

  it('levels_are_summed_per_date_with_the_pulse', () => {
    const days = dailyTotals(
      [
        { timestamp: '2026-10-26T09:00:00Z', duration: 600, level: 100 },
        { timestamp: '2026-10-26T10:00:00Z', duration: 600, level: 0 },
        { timestamp: '2026-10-25T10:00:00Z', duration: 60, level: 75 },
      ],
      'UTC'
    )
    expect(days).toStrictEqual([
      {
        date: '2026-10-25',
        seconds: 60,
        secondsByLevel: { '0': 0, '25': 0, '50': 0, '75': 60, '100': 0 },
        pulse: 75,
      },
      {
        date: '2026-10-26',
        seconds: 1200,
        secondsByLevel: { '0': 600, '25': 0, '50': 0, '75': 0, '100': 600 },
        pulse: 50,
      },
    ])
  })

  it('the_pinned_zone_decides_the_date_not_utc', () => {
    // 23:30 UTC on 25 October is already 26 October in a zone ahead of UTC.
    const instant = epochSecondsOf('2026-10-25T23:30:00Z')
    expect(localDateOf(instant, 'UTC')).toBe('2026-10-25')
    expect(localDateOf(instant, 'Pacific/Auckland')).toBe('2026-10-26')
    expect(localDateOf(instant, 'America/New_York')).toBe('2026-10-25')
  })

  it('next_local_midnight_is_the_first_second_of_the_next_date', () => {
    const midnight = nextLocalMidnight(epochSecondsOf('2026-10-26T12:00:00Z'), 'Etc/GMT-10')
    expect(utcInstantOf(midnight)).toBe('2026-10-26T14:00:00Z')
  })

  it('an_unknown_time_zone_fails_loudly', () => {
    expect(() => localDateOf(0, 'Not/AZone')).toThrow(RangeError)
  })
})
