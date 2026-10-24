// SPDX-License-Identifier: AGPL-3.0-or-later
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ActivityEvent, SyncBlock } from '@monki-focus/analytics'

/** Name of the extension's IndexedDB database. */
export const DB_NAME = 'monki'

/**
 * Schema version. Migrations are additive: a later work package (intentions,
 * bypass events) bumps this and only creates stores or indexes in the
 * upgrade step for its version; existing stores are never dropped or renamed.
 */
export const DB_VERSION = 1

/** A raw ActivityWatch-style event as stored: one row per merged heartbeat run. */
export interface StoredEvent extends ActivityEvent {
  id?: number
  bucketId: string
}

/**
 * The natural key of a block, `[deviceId, blockStart, activityKey, categoryPath,
 * source, level]`: the fields `toBlocks` sums by (plus the device). IndexedDB
 * keys cannot hold `null`, so a null activity key is stored as `''` (never a
 * valid key: it must start with a letter or digit).
 */
export type BlockKey = [string, string, string, string, string, number]

export interface StoredBlock extends SyncBlock {
  key: BlockKey
}

export interface OutboxEntry {
  id?: number
  kind: 'block'
  /** What later sync uploads; only the seven sync-block fields. */
  payload: SyncBlock
  enqueuedAt: string
}

export interface MonkiDbSchema extends DBSchema {
  events: {
    key: number
    value: StoredEvent
    indexes: { bucketTimestamp: [string, string]; timestamp: string }
  }
  blocks: {
    key: BlockKey
    value: StoredBlock
    indexes: { blockStart: string }
  }
  outbox: {
    key: number
    value: OutboxEntry
  }
}

export type MonkiDb = IDBPDatabase<MonkiDbSchema>

/** Opens (and creates or upgrades) the extension database. */
export function openMonkiDb(name: string = DB_NAME): Promise<MonkiDb> {
  return openDB<MonkiDbSchema>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const events = db.createObjectStore('events', { keyPath: 'id', autoIncrement: true })
        events.createIndex('bucketTimestamp', ['bucketId', 'timestamp'])
        events.createIndex('timestamp', 'timestamp')
        const blocks = db.createObjectStore('blocks', { keyPath: 'key' })
        blocks.createIndex('blockStart', 'blockStart')
        db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true })
      }
    },
  })
}
