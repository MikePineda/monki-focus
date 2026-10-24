// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { WeekStatsQuery } from '../../../../src/background/stats/WeekStatsQuery'
import { IdbBlockRepository } from '../../../../src/background/storage/IdbBlockRepository'
import { makeBlock } from '../../../factories/makeEvent'
import { freshDb } from '../../../support/testDb'

// Monday 2026-01-05, 15:00 UTC.
const NOW = Date.parse('2026-01-05T15:00:00Z')

describe('WeekStatsQuery', () => {
  let blocks: IdbBlockRepository
  let query: WeekStatsQuery

  beforeEach(async () => {
    blocks = new IdbBlockRepository(await freshDb())
    query = new WeekStatsQuery(blocks)
  })

  it('stats_week_has_seven_daily_pulses_oldest_first', async () => {
    await blocks.upsert([
      makeBlock({ blockStart: '2026-01-05T09:00:00Z', level: 100, seconds: 300 }),
      makeBlock({ blockStart: '2026-01-03T09:00:00Z', level: 0, seconds: 100 }),
      makeBlock({ blockStart: '2026-01-03T09:05:00Z', level: 100, seconds: 300 }),
      makeBlock({ blockStart: '2025-12-29T09:00:00Z', level: 0, seconds: 300 }),
    ])

    const { days } = await query.run(NOW, 'UTC')

    expect(days).toEqual([
      { date: '2025-12-30', pulse: null, totalSeconds: 0 },
      { date: '2025-12-31', pulse: null, totalSeconds: 0 },
      { date: '2026-01-01', pulse: null, totalSeconds: 0 },
      { date: '2026-01-02', pulse: null, totalSeconds: 0 },
      { date: '2026-01-03', pulse: 75, totalSeconds: 400 },
      { date: '2026-01-04', pulse: null, totalSeconds: 0 },
      { date: '2026-01-05', pulse: 100, totalSeconds: 300 },
    ])
  })

  it('hourly_cells_average_four_weeks_per_weekday_and_local_hour', async () => {
    await blocks.upsert([
      // Mondays 09:xx in UTC, four weeks running, plus one five weeks ago (outside).
      makeBlock({ blockStart: '2026-01-05T09:00:00Z', level: 100, seconds: 300 }),
      makeBlock({ blockStart: '2025-12-29T09:10:00Z', level: 0, seconds: 100 }),
      makeBlock({ blockStart: '2025-12-22T09:55:00Z', level: 0, seconds: 100 }),
      makeBlock({ blockStart: '2025-12-15T09:30:00Z', level: 100, seconds: 300 }),
      makeBlock({ blockStart: '2025-12-08T09:30:00Z', level: 0, seconds: 300 }),
    ])

    const week = await query.run(NOW, 'UTC')

    expect(week.weeks).toBe(4)
    expect(week.hourly).toHaveLength(7 * 24)
    expect(week.hourly.find((cell) => cell.weekday === 0 && cell.hour === 9)).toEqual({
      weekday: 0,
      hour: 9,
      averageSeconds: 200,
      pulse: 75,
    })
    expect(week.hourly.find((cell) => cell.weekday === 0 && cell.hour === 10)).toMatchObject({
      averageSeconds: 0,
      pulse: null,
    })
  })

  it('hourly_cells_use_the_pinned_time_zone', async () => {
    // 09:00Z on a Monday is 20:00 the same Monday in Sydney (UTC+11).
    await blocks.upsert([makeBlock({ blockStart: '2026-01-05T09:00:00Z', seconds: 400 / 2 })])

    const week = await query.run(NOW, 'Australia/Sydney')

    const busy = week.hourly.filter((cell) => cell.averageSeconds > 0)
    expect(busy).toEqual([{ weekday: 0, hour: 20, averageSeconds: 50, pulse: 50 }])
  })
})
