// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { IdbBlockRepository } from '../../../../src/background/storage/IdbBlockRepository'
import { IdbEventRepository } from '../../../../src/background/storage/IdbEventRepository'
import { Retention, retentionCutoff } from '../../../../src/background/storage/Retention'
import { makeBlock, makeEvent } from '../../../factories/makeEvent'
import { freshDb } from '../../../support/testDb'

const BUCKET = 'monki-web-chrome_device-a'
const NOW = '2026-03-01T12:00:00Z'

describe('Retention', () => {
  let events: IdbEventRepository
  let blocks: IdbBlockRepository

  beforeEach(async () => {
    const db = await freshDb()
    events = new IdbEventRepository(db)
    blocks = new IdbBlockRepository(db)
  })

  it('cutoff_is_thirty_days_before_now', () => {
    expect(retentionCutoff(NOW)).toBe('2026-01-30T12:00:00Z')
  })

  it('retention_purges_raw_events_older_than_30_days_and_keeps_blocks', async () => {
    await events.add(BUCKET, makeEvent({ timestamp: '2026-01-30T11:59:59Z' }))
    await events.add(BUCKET, makeEvent({ timestamp: '2026-01-30T12:00:00Z' }))
    await blocks.upsert([makeBlock({ blockStart: '2025-06-01T09:00:00Z' })])

    const purged = await new Retention(events).purge(NOW)

    expect(purged).toBe(1)
    const kept = await events.between(BUCKET, '2025-01-01T00:00:00Z', NOW)
    expect(kept.map((event) => event.timestamp)).toEqual(['2026-01-30T12:00:00Z'])
    expect(await blocks.between('2025-06-01T00:00:00Z', '2025-06-02T00:00:00Z')).toHaveLength(1)
  })
})
