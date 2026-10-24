// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ActivityEvent } from '@monki-focus/analytics'
import type { MonkiDb } from './db'
import type { EventRepository } from './EventRepository'

/** Only the three event fields: never the row id or bucket, never extra keys. */
function toEvent(stored: ActivityEvent): ActivityEvent {
  return { timestamp: stored.timestamp, duration: stored.duration, data: stored.data }
}

/**
 * Events in the `events` store, read through the `[bucketId, timestamp]`
 * index. Timestamps are canonical UTC instants (`YYYY-MM-DDTHH:MM:SSZ`), so
 * string order is time order.
 */
export class IdbEventRepository implements EventRepository {
  constructor(private readonly db: MonkiDb) {}

  async add(bucketId: string, event: ActivityEvent): Promise<number> {
    return this.db.add('events', { bucketId, ...toEvent(event) })
  }

  async replace(id: number, bucketId: string, event: ActivityEvent): Promise<void> {
    await this.db.put('events', { id, bucketId, ...toEvent(event) })
  }

  async between(bucketId: string, from: string, to: string): Promise<ActivityEvent[]> {
    const range = IDBKeyRange.bound([bucketId, from], [bucketId, to], false, true)
    const rows = await this.db.getAllFromIndex('events', 'bucketTimestamp', range)
    return rows.map(toEvent)
  }

  async deleteBefore(before: string): Promise<number> {
    const tx = this.db.transaction('events', 'readwrite')
    let deleted = 0
    let cursor = await tx.store.index('timestamp').openCursor(IDBKeyRange.upperBound(before, true))
    while (cursor) {
      await cursor.delete()
      deleted += 1
      cursor = await cursor.continue()
    }
    await tx.done
    return deleted
  }
}
