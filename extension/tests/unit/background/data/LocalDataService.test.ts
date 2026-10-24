// SPDX-License-Identifier: AGPL-3.0-or-later
import { fromActivityWatchExport, type ActivityWatchExport } from '@monki-focus/analytics'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { blocksCsv } from '../../../../src/background/data/BlocksCsv'
import { LocalDataService } from '../../../../src/background/data/LocalDataService'
import type { MonkiDb } from '../../../../src/background/storage/db'
import { IdbBlockRepository } from '../../../../src/background/storage/IdbBlockRepository'
import { IdbEventRepository } from '../../../../src/background/storage/IdbEventRepository'
import { Outbox } from '../../../../src/background/storage/Outbox'
import { AGGREGATED_THROUGH_STORAGE_NAME } from '../../../../src/background/tracking/AggregationJob'
import { OPEN_HEARTBEAT_STORAGE_NAME } from '../../../../src/background/tracking/HeartbeatRecorder'
import { fixedClock } from '../../../../src/shared/clock'
import { makeBlock, makeEvent } from '../../../factories/makeEvent'
import { freshDb } from '../../../support/testDb'

const BUCKET = 'monki-web-chrome_device-a'

describe('LocalDataService', () => {
  let db: MonkiDb
  let service: LocalDataService
  const quiesce = vi.fn(() => Promise.resolve())

  beforeEach(async () => {
    fakeBrowser.reset()
    db = await freshDb()
    service = new LocalDataService({
      db,
      clock: fixedClock('2026-01-06T08:00:00Z'),
      deviceId: 'device-a',
      bucketId: BUCKET,
      session: fakeBrowser.storage.session,
      local: fakeBrowser.storage.local,
      quiesce,
    })
  })

  it('exports_the_web_events_in_activitywatch_format', async () => {
    const events = new IdbEventRepository(db)
    await events.add(BUCKET, makeEvent({ timestamp: '2026-01-05T09:00:00Z', duration: 90 }))
    await events.add('another-bucket', makeEvent())

    const file = await service.export('activitywatch')

    expect(file).toMatchObject({
      fileName: 'monki-focus-activitywatch-2026-01-06.json',
      mimeType: 'application/json',
    })
    const [bucket] = fromActivityWatchExport(JSON.parse(file.text) as ActivityWatchExport)
    expect(bucket).toMatchObject({ id: BUCKET, type: 'web.tab.current', hostname: 'device-a' })
    expect(bucket?.events).toEqual([makeEvent({ duration: 90 })])
  })

  it('exports_the_blocks_as_csv', async () => {
    await new IdbBlockRepository(db).upsert([makeBlock()])

    const file = await service.export('csv')

    expect(file.fileName).toBe('monki-focus-blocks-2026-01-06.csv')
    expect(file.text).toBe(
      'block_start,activity_key,category,level,source,seconds\r\n' +
        '2026-01-05T09:00:00Z,news.example,news,50,web,120\r\n'
    )
  })

  it('delete_all_erases_events_blocks_and_queued_blocks_but_keeps_other_outbox_records', async () => {
    await new IdbEventRepository(db).add(BUCKET, makeEvent())
    await new IdbBlockRepository(db).upsert([makeBlock()])
    await new Outbox(db).enqueueBlocks([makeBlock()], '2026-01-05T09:05:00Z')
    await db.add('outbox', {
      kind: 'bypass' as 'block',
      payload: makeBlock(),
      enqueuedAt: '2026-01-05T09:06:00Z',
    })
    await fakeBrowser.storage.session.set({ [OPEN_HEARTBEAT_STORAGE_NAME]: { id: 1 } })
    await fakeBrowser.storage.local.set({ [AGGREGATED_THROUGH_STORAGE_NAME]: 'x' })

    const deleted = await service.deleteAll()

    expect(deleted.stores).toEqual(['blocks', 'events', 'intentions', 'outbox'])
    expect(await db.count('events')).toBe(0)
    expect(await db.count('blocks')).toBe(0)
    expect((await db.getAll('outbox')).map((entry) => entry.kind)).toEqual(['bypass'])
    expect(await fakeBrowser.storage.session.get(OPEN_HEARTBEAT_STORAGE_NAME)).toEqual({})
    expect(await fakeBrowser.storage.local.get(AGGREGATED_THROUGH_STORAGE_NAME)).toEqual({})
    expect(quiesce).toHaveBeenCalledOnce()
  })

  it('a_write_in_flight_during_delete_is_erased_too', async () => {
    quiesce.mockImplementationOnce(async () => {
      await new IdbBlockRepository(db).upsert([makeBlock()])
    })

    await service.deleteAll()

    expect(await db.count('blocks')).toBe(0)
  })
})

describe('blocksCsv', () => {
  it('guards_fields_a_spreadsheet_would_read_as_formulas', () => {
    const csv = blocksCsv([makeBlock({ activityKey: null, categoryPath: '=cmd' })])

    expect(csv.split('\r\n')[1]).toBe("2026-01-05T09:00:00Z,,'=cmd,50,web,120")
  })
})
