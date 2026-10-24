// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { TodayStatsQuery } from '../../../../src/background/stats/TodayStatsQuery'
import { IdbBlockRepository } from '../../../../src/background/storage/IdbBlockRepository'
import { makeBlock } from '../../../factories/makeEvent'
import { freshDb } from '../../../support/testDb'

/** RescueTime: Σ(seconds × k) / (Σ seconds × 4) × 100 with k = 0..4. */
function rescueTimePulse(entries: { seconds: number; k: number }[]): number {
  const total = entries.reduce((sum, entry) => sum + entry.seconds, 0)
  const weighted = entries.reduce((sum, entry) => sum + entry.seconds * entry.k, 0)
  return Math.round((weighted / (total * 4)) * 100)
}

describe('TodayStatsQuery', () => {
  let blocks: IdbBlockRepository
  let query: TodayStatsQuery

  beforeEach(async () => {
    blocks = new IdbBlockRepository(await freshDb())
    query = new TodayStatsQuery(blocks)
  })

  it('stats_today_summarises_a_synthetic_day', async () => {
    await blocks.upsert([
      makeBlock({
        blockStart: '2026-01-05T09:00:00Z',
        activityKey: 'social.example',
        categoryPath: 'social',
        level: 0,
        seconds: 300,
      }),
      makeBlock({
        blockStart: '2026-01-05T09:05:00Z',
        activityKey: 'social.example',
        categoryPath: 'social',
        level: 0,
        seconds: 300,
      }),
      makeBlock({
        blockStart: '2026-01-05T10:00:00Z',
        activityKey: 'video.example',
        categoryPath: 'video',
        level: 25,
        seconds: 240,
      }),
      makeBlock({
        blockStart: '2026-01-05T11:00:00Z',
        activityKey: 'news.example',
        categoryPath: 'uncategorised',
        level: 50,
        seconds: 180,
      }),
      makeBlock({
        blockStart: '2026-01-05T12:00:00Z',
        activityKey: 'wiki.example',
        categoryPath: 'reference',
        level: 75,
        seconds: 120,
      }),
      makeBlock({
        blockStart: '2026-01-05T13:00:00Z',
        activityKey: 'code.example',
        categoryPath: 'development',
        level: 100,
        seconds: 300,
      }),
      makeBlock({
        blockStart: '2026-01-05T13:05:00Z',
        activityKey: 'code.example',
        categoryPath: 'development',
        level: 100,
        seconds: 300,
      }),
      makeBlock({
        blockStart: '2026-01-05T14:00:00Z',
        activityKey: 'mail.example',
        categoryPath: 'communication',
        level: 75,
        seconds: 60,
      }),
      // Yesterday and tomorrow (UTC) never count.
      makeBlock({
        blockStart: '2026-01-04T23:55:00Z',
        activityKey: 'social.example',
        categoryPath: 'social',
        level: 0,
        seconds: 300,
      }),
    ])

    const stats = await query.run(Date.parse('2026-01-05T15:00:00Z'), 'UTC')

    expect(stats).toEqual({
      date: '2026-01-05',
      pulse: rescueTimePulse([
        { seconds: 600, k: 0 },
        { seconds: 240, k: 1 },
        { seconds: 180, k: 2 },
        { seconds: 180, k: 3 },
        { seconds: 600, k: 4 },
      ]),
      totalSeconds: 1800,
      levels: { 0: 600, 1: 240, 2: 0, 3: 180, 4: 600 },
      uncategorisedSeconds: 180,
      topActivities: [
        { activityKey: 'code.example', seconds: 600, level: 4 },
        { activityKey: 'social.example', seconds: 600, level: 0 },
        { activityKey: 'video.example', seconds: 240, level: 1 },
        { activityKey: 'news.example', seconds: 180, level: 2 },
        { activityKey: 'wiki.example', seconds: 120, level: 3 },
      ],
      intentions: { total: 0, kept: 0, broken: 0, closes: 0 },
    })
    expect(stats.pulse).toBe(49)
  })

  it('pulse_is_null_without_tracked_time', async () => {
    const stats = await query.run(Date.parse('2026-01-05T15:00:00Z'), 'UTC')

    expect(stats).toMatchObject({ pulse: null, totalSeconds: 0, topActivities: [] })
  })

  it('the_local_day_follows_the_pinned_time_zone', async () => {
    // 2026-01-05 in Australia/Sydney (UTC+11) runs 2026-01-04T13:00Z .. 2026-01-05T13:00Z.
    await blocks.upsert([
      makeBlock({ blockStart: '2026-01-04T12:55:00Z', seconds: 10 }),
      makeBlock({ blockStart: '2026-01-04T13:00:00Z', seconds: 20 }),
      makeBlock({ blockStart: '2026-01-05T12:55:00Z', seconds: 30 }),
      makeBlock({ blockStart: '2026-01-05T13:00:00Z', seconds: 40 }),
    ])

    const stats = await query.run(Date.parse('2026-01-05T12:59:59Z'), 'Australia/Sydney')

    expect(stats).toMatchObject({ date: '2026-01-05', totalSeconds: 50 })
  })

  it('daily_totals_respect_dst_in_australia_sydney', async () => {
    // Sydney springs forward on 2026-10-04 at 02:00 local: a 23-hour day from
    // 2026-10-03T14:00Z (00:00 +10:00) to 2026-10-04T13:00Z (00:00 +11:00).
    await blocks.upsert([
      makeBlock({ blockStart: '2026-10-03T13:55:00Z', seconds: 1 }),
      makeBlock({ blockStart: '2026-10-03T14:00:00Z', seconds: 10 }),
      makeBlock({ blockStart: '2026-10-03T16:00:00Z', seconds: 20 }),
      makeBlock({ blockStart: '2026-10-04T12:55:00Z', seconds: 30 }),
      makeBlock({ blockStart: '2026-10-04T13:00:00Z', seconds: 2 }),
    ])

    const stats = await query.run(Date.parse('2026-10-04T12:59:00Z'), 'Australia/Sydney')

    expect(stats).toMatchObject({ date: '2026-10-04', totalSeconds: 60 })
  })

  it('top_activities_are_capped_at_five', async () => {
    await blocks.upsert(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((name, index) =>
        makeBlock({ activityKey: `${name}.example`, seconds: 10 + index })
      )
    )

    const stats = await query.run(Date.parse('2026-01-05T15:00:00Z'), 'UTC')

    expect(stats.topActivities.map((activity) => activity.activityKey)).toEqual([
      'f.example',
      'e.example',
      'd.example',
      'c.example',
      'b.example',
    ])
  })
})
