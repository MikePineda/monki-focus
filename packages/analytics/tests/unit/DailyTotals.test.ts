// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { dailyTotals } from '../../src/index.ts'

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
    const entries = [{ timestamp: '2026-10-25T23:30:00Z', duration: 60, level: 50 } as const]
    expect(dailyTotals(entries, 'UTC').map((day) => day.date)).toStrictEqual(['2026-10-25'])
    expect(dailyTotals(entries, 'Etc/GMT-10').map((day) => day.date)).toStrictEqual(['2026-10-26'])
  })

  it('an_unknown_time_zone_fails_loudly', () => {
    const entries = [{ timestamp: '2026-10-25T23:30:00Z', duration: 60, level: 50 } as const]
    expect(() => dailyTotals(entries, 'Not/AZone')).toThrow(RangeError)
  })
})
