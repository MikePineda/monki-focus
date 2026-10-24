// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { IntentionStatsQuery } from '../../../../src/background/stats/IntentionStatsQuery'
import { TodayStatsQuery } from '../../../../src/background/stats/TodayStatsQuery'
import type { MonkiDb } from '../../../../src/background/storage/db'
import { IntentionLog } from '../../../../src/background/storage/IntentionLog'
import { Outbox } from '../../../../src/background/storage/Outbox'
import { freshDb } from '../../../support/testDb'

const NOW = Date.parse('2026-01-05T09:00:00Z')

describe('IntentionLog', () => {
  let db: MonkiDb
  let log: IntentionLog

  beforeEach(async () => {
    db = await freshDb()
    log = new IntentionLog(db)
  })

  it('stats_today_counts_real_intentions_from_the_gate', async () => {
    for (const [at, kind] of [
      ['2026-01-05T08:00:00Z', 'visit'],
      ['2026-01-05T08:00:20Z', 'committed'],
      ['2026-01-05T08:10:20Z', 'kept'],
      ['2026-01-05T08:20:00Z', 'committed'],
      ['2026-01-05T08:25:20Z', 'broken'],
      ['2026-01-05T08:40:00Z', 'closed'],
      ['2026-01-04T22:00:00Z', 'closed'],
    ] as const) {
      await log.record({ at, kind, group: 'rule-a' })
    }

    const stats = await new TodayStatsQuery(
      { between: () => Promise.resolve([]) },
      new IntentionStatsQuery(log)
    ).run(NOW, 'UTC')

    expect(stats.intentions).toEqual({ total: 2, kept: 1, broken: 1, closes: 1 })
  })

  it('a_day_counts_visits_per_group', async () => {
    await log.record({ at: '2026-01-05T08:00:00Z', kind: 'visit', group: 'rule-a' })
    await log.record({ at: '2026-01-05T08:05:00Z', kind: 'visit', group: 'rule-b' })

    const day = await new IntentionStatsQuery(log).today(NOW, 'UTC')

    expect(day.count('visit', 'rule-a')).toBe(1)
    expect(day.count('visit')).toBe(2)
  })

  it('old_entries_are_purged', async () => {
    await log.record({ at: '2025-11-01T08:00:00Z', kind: 'visit', group: 'rule-a' })
    await log.record({ at: '2026-01-05T08:00:00Z', kind: 'visit', group: 'rule-a' })

    expect(await log.deleteBefore('2025-12-06T09:00:00Z')).toBe(1)
    expect(await log.between('2025-01-01T00:00:00Z', '2027-01-01T00:00:00Z')).toHaveLength(1)
  })

  it('a_bypass_in_the_outbox_carries_a_group_and_timestamps_only', async () => {
    const outbox = new Outbox(db)

    await outbox.enqueueBypass(
      {
        dedupeKey: 'bypass-1',
        kind: 'emergency_override',
        occurredAt: '2026-01-05T09:02:00Z',
        details: { targetGroup: 'rule-a', grantedAt: '2026-01-05T09:02:00Z' },
      },
      '2026-01-05T09:02:00Z'
    )

    const [entry] = await outbox.peek(10)
    expect(entry).toMatchObject({ kind: 'bypass', payload: { kind: 'emergency_override' } })
  })
})
