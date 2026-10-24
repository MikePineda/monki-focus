// SPDX-License-Identifier: AGPL-3.0-or-later
import { toActivityWatchExport, toSyncBlock } from '@monki-focus/analytics'
import { instantOf } from '@monki-focus/engine'
import type { Browser } from 'wxt/browser'
import type { Clock } from '../../shared/clock'
import type { DeletedLocalData, ExportedFile, ExportFormat } from '../../shared/LocalDataContract'
import type { MonkiDb } from '../storage/db'
import { OPEN_HEARTBEAT_STORAGE_NAME } from '../tracking/HeartbeatRecorder'
import { AGGREGATED_THROUGH_STORAGE_NAME } from '../tracking/AggregationJob'
import { blocksCsv } from './BlocksCsv'

const EARLIEST = '0000-01-01T00:00:00Z'
const LATEST = '9999-12-31T23:59:59Z'

/**
 * Stores whose records must outlive "Delete all local data": a bypass
 * record (a later work package) is what the guardian is owed, so deleting
 * local history must never erase it. Outbox entries other than blocks stay
 * for the same reason.
 */
const RETAINED_STORES: ReadonlySet<string> = new Set(['outbox', 'bypassEvents'])

export interface LocalDataServiceOptions {
  db: MonkiDb
  clock: Clock
  deviceId: string
  /** The web bucket id (`monki-web-chrome_<device>`). */
  bucketId: string
  session: Pick<Browser.storage.StorageArea, 'remove'>
  local: Pick<Browser.storage.StorageArea, 'remove'>
  /** Resolves once pulses and aggregation runs already started have finished. */
  quiesce: () => Promise<void>
}

/** Export and erasure of the user's local activity (options page, Stats). */
export class LocalDataService {
  constructor(private readonly options: LocalDataServiceOptions) {}

  async export(format: ExportFormat): Promise<ExportedFile> {
    const { db, clock, deviceId, bucketId } = this.options
    const date = instantOf(clock.now()).slice(0, 10)
    if (format === 'csv') {
      const blocks = await db.getAllFromIndex(
        'blocks',
        'blockStart',
        IDBKeyRange.bound(EARLIEST, LATEST)
      )
      return {
        fileName: `monki-focus-blocks-${date}.csv`,
        mimeType: 'text/csv',
        text: blocksCsv(blocks.map((block) => toSyncBlock(block))),
      }
    }
    const events = await db.getAllFromIndex(
      'events',
      'bucketTimestamp',
      IDBKeyRange.bound([bucketId, EARLIEST], [bucketId, LATEST])
    )
    const created = events[0]?.timestamp ?? instantOf(clock.now())
    const document = toActivityWatchExport([
      {
        id: bucketId,
        type: 'web.tab.current',
        client: 'monki-focus-web',
        hostname: deviceId,
        created,
        events: events.map(({ timestamp, duration, data }) => ({ timestamp, duration, data })),
      },
    ])
    return {
      fileName: `monki-focus-activitywatch-${date}.json`,
      mimeType: 'application/json',
      text: `${JSON.stringify(document, null, 2)}\n`,
    }
  }

  /**
   * Erases tracked events, blocks and history. The open heartbeat and the
   * aggregation watermark go too, so tracking starts over cleanly. Runs
   * twice around `quiesce`, so a pulse or an aggregation already in flight
   * cannot write back what was just deleted.
   */
  async deleteAll(): Promise<DeletedLocalData> {
    const stores = await this.eraseOnce()
    await this.options.quiesce().catch(() => undefined)
    await this.eraseOnce()
    return { stores }
  }

  private async eraseOnce(): Promise<string[]> {
    const { db, session, local } = this.options
    await session.remove(OPEN_HEARTBEAT_STORAGE_NAME)
    await local.remove(AGGREGATED_THROUGH_STORAGE_NAME)
    const names = [...db.objectStoreNames].filter((name) => !RETAINED_STORES.has(name))
    const tx = db.transaction([...names, 'outbox'] as (typeof names)[number][], 'readwrite')
    const work: Promise<unknown>[] = names.map((name) => tx.objectStore(name).clear())
    const outbox = tx.objectStore('outbox' as (typeof names)[number])
    let cursor = await outbox.openCursor()
    while (cursor) {
      if ((cursor.value as { kind?: unknown }).kind === 'block') work.push(cursor.delete())
      cursor = await cursor.continue()
    }
    await Promise.all([...work, tx.done])
    return [...names, 'outbox'].sort()
  }
}
