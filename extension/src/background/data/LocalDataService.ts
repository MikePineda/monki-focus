// SPDX-License-Identifier: AGPL-3.0-or-later
import { toActivityWatchExport, toSyncBlock } from '@monki-focus/analytics'
import { epochSecondsOf, instantOf, nextLocalMidnight, utcInstantOf } from '@monki-focus/engine'
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

/** Stores whose records of the current local day stay (today's usage). */
const DAY_KEPT_STORES: ReadonlySet<string> = new Set(['events', 'blocks'])

export interface LocalDataServiceOptions {
  db: MonkiDb
  clock: Clock
  deviceId: string
  /** The web bucket id (`monki-web-chrome_<device>`). */
  bucketId: string
  session: Pick<Browser.storage.StorageArea, 'get' | 'remove'>
  local: Pick<Browser.storage.StorageArea, 'remove'>
  /** The rule set's pinned zone: "today" is the local day there. */
  timeZone: () => Promise<string>
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
   * Erases tracked events, blocks and history **before the current local
   * day** (in the rule set's pinned zone). Today's events and blocks stay:
   * they are what today's budgets and Pulse count, so a delete can never
   * reset a budget. The aggregation watermark goes, so the next run rebuilds
   * blocks from what is left. Runs twice around `quiesce`, so a pulse or an
   * aggregation already in flight cannot write back what was just deleted.
   */
  async deleteAll(): Promise<DeletedLocalData> {
    const dayStart = await this.todayStart()
    const stores = await this.eraseBefore(dayStart)
    await this.options.quiesce().catch(() => undefined)
    await this.eraseBefore(dayStart)
    return { stores }
  }

  /** The last local midnight at or before now, in epoch seconds. */
  private async todayStart(): Promise<number> {
    const nowSeconds = epochSecondsOf(instantOf(this.options.clock.now()))
    const zone = await this.options.timeZone().catch(() => 'UTC')
    let start = nextLocalMidnight(nowSeconds - 90_000, zone)
    for (let next = nextLocalMidnight(start, zone); next <= nowSeconds;) {
      start = next
      next = nextLocalMidnight(start, zone)
    }
    return start
  }

  private async eraseBefore(dayStartSeconds: number): Promise<string[]> {
    const { db, session, local } = this.options
    const dayStart = utcInstantOf(dayStartSeconds)
    const endsBeforeToday = (event: { timestamp: string; duration: number }) =>
      epochSecondsOf(event.timestamp) + event.duration <= dayStartSeconds
    const open: unknown = (await session.get(OPEN_HEARTBEAT_STORAGE_NAME))[
      OPEN_HEARTBEAT_STORAGE_NAME
    ]
    const openEvent = (open as { event?: { timestamp?: unknown; duration?: unknown } } | undefined)
      ?.event
    if (
      openEvent === undefined ||
      typeof openEvent.timestamp !== 'string' ||
      typeof openEvent.duration !== 'number' ||
      endsBeforeToday({ timestamp: openEvent.timestamp, duration: openEvent.duration })
    ) {
      await session.remove(OPEN_HEARTBEAT_STORAGE_NAME)
    }
    await local.remove(AGGREGATED_THROUGH_STORAGE_NAME)

    const others = [...db.objectStoreNames].filter(
      (name) => !RETAINED_STORES.has(name) && !DAY_KEPT_STORES.has(name)
    )
    const names = [...others, 'events', 'blocks', 'outbox'] as (typeof others)[number][]
    const tx = db.transaction(names, 'readwrite')
    const work: Promise<unknown>[] = others.map((name) => tx.objectStore(name).clear())
    const before = IDBKeyRange.upperBound(dayStart, true)

    let event = await tx.objectStore('events').index('timestamp').openCursor(before)
    while (event) {
      if (endsBeforeToday(event.value)) work.push(event.delete())
      event = await event.continue()
    }
    let block = await tx.objectStore('blocks').index('blockStart').openCursor(before)
    while (block) {
      work.push(block.delete())
      block = await block.continue()
    }
    let queued = await tx.objectStore('outbox').openCursor()
    while (queued) {
      const entry = queued.value
      if (entry.kind === 'block' && entry.payload.blockStart < dayStart) work.push(queued.delete())
      queued = await queued.continue()
    }
    await Promise.all([...work, tx.done])
    return [...names].sort()
  }
}
