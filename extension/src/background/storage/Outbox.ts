// SPDX-License-Identifier: AGPL-3.0-or-later
import { toSyncBlock, type SyncBlock } from '@monki-focus/analytics'
import type { MonkiDb, OutboxEntry } from './db'

/**
 * Records waiting for the optional server sync (a later work package). Only
 * sync blocks enter, through `toSyncBlock`, so nothing here can carry a
 * title, a URL or a path. Nothing reads it to send yet.
 */
export class Outbox {
  constructor(private readonly db: MonkiDb) {}

  async enqueueBlocks(blocks: readonly SyncBlock[], enqueuedAt: string): Promise<void> {
    if (blocks.length === 0) return
    const tx = this.db.transaction('outbox', 'readwrite')
    await Promise.all([
      ...blocks.map((block) =>
        tx.store.add({ kind: 'block', payload: toSyncBlock(block), enqueuedAt })
      ),
      tx.done,
    ])
  }

  /** The oldest `limit` entries, for the future sender. */
  peek(limit: number): Promise<OutboxEntry[]> {
    return this.db.getAll('outbox', undefined, limit)
  }

  /** Removes entries the server acknowledged. */
  async acknowledge(ids: readonly number[]): Promise<void> {
    const tx = this.db.transaction('outbox', 'readwrite')
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done])
  }
}
