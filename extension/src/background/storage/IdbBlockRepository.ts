// SPDX-License-Identifier: AGPL-3.0-or-later
import { toSyncBlock, type SyncBlock } from '@monki-focus/analytics'
import type { BlockKey, MonkiDb, StoredBlock } from './db'
import type { BlockRepository } from './BlockRepository'

export function blockKeyOf(block: SyncBlock): BlockKey {
  return [
    block.deviceId,
    block.blockStart,
    block.activityKey ?? '',
    block.categoryPath,
    block.source,
    block.level,
  ]
}

function stored(block: SyncBlock): StoredBlock {
  // `toSyncBlock` copies the seven allowed fields only and rejects bad values,
  // so a title or URL can never ride along into the store.
  const checked = toSyncBlock(block)
  return { ...checked, key: blockKeyOf(checked) }
}

function unstored(row: StoredBlock): SyncBlock {
  const { deviceId, blockStart, activityKey, categoryPath, level, source, seconds } = row
  return { deviceId, blockStart, activityKey, categoryPath, level, source, seconds }
}

function sameKey(a: BlockKey, b: BlockKey): boolean {
  return a.every((part, index) => part === b[index])
}

/** Blocks in the `blocks` store, keyed by their natural key. */
export class IdbBlockRepository implements BlockRepository {
  constructor(private readonly db: MonkiDb) {}

  async upsert(blocks: readonly SyncBlock[]): Promise<void> {
    const rows = blocks.map(stored)
    const tx = this.db.transaction('blocks', 'readwrite')
    await Promise.all([...rows.map((row) => tx.store.put(row)), tx.done])
  }

  async replaceRange(
    deviceId: string,
    from: string,
    to: string,
    blocks: readonly SyncBlock[]
  ): Promise<SyncBlock[]> {
    const rows = blocks.map(stored)
    const tx = this.db.transaction('blocks', 'readwrite')
    const existing = (
      await tx.store.index('blockStart').getAll(IDBKeyRange.bound(from, to, false, true))
    ).filter((row) => row.deviceId === deviceId)
    const changed: SyncBlock[] = []
    for (const row of rows) {
      const before = existing.find((old) => sameKey(old.key, row.key))
      if (before?.seconds !== row.seconds) changed.push(unstored(row))
      await tx.store.put(row)
    }
    for (const old of existing) {
      if (!rows.some((row) => sameKey(row.key, old.key))) await tx.store.delete(old.key)
    }
    await tx.done
    return changed
  }

  async between(from: string, to: string): Promise<SyncBlock[]> {
    const rows = await this.db.getAllFromIndex(
      'blocks',
      'blockStart',
      IDBKeyRange.bound(from, to, false, true)
    )
    return rows.map(unstored)
  }
}
