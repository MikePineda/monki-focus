// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { NO_RULE_SET_REVISION } from '#domain/rules/rule_set_etag'

export const RULE_SETS_TABLE = 'rule_sets'

/** The user's stored rule set (database/migrations/1793000000701_create_rule_sets_table.ts). */
export interface StoredRuleSet {
  readonly revision: number
  readonly document: unknown
  readonly contentHash: string
  readonly updatedAt: Date
  readonly updatedByDeviceId: number | null
}

export interface RuleSetWrite {
  readonly document: unknown
  readonly contentHash: string
  readonly deviceId: number | null
  readonly now: DateTime
}

export type CompareAndSwap =
  | { readonly ok: true; readonly revision: number }
  | { readonly ok: false; readonly current: number }

interface Row {
  revision: number
  document: unknown
  content_hash: string
  updated_at: Date
  updated_by_device_id: number | null
}

/**
 * Persistence of the one rule set per user, always through the owner's id
 * (no route addresses another user's row). Writes are a compare-and-swap
 * on `revision` in one statement: an `UPDATE ... WHERE revision = expected`
 * or, for revision 0, an `INSERT ... ON CONFLICT DO NOTHING`. A lost race
 * answers the revision that won, never a 409 or a lock wait. The document
 * is never logged.
 */
export default class RuleSetStore {
  async find(userId: number): Promise<StoredRuleSet | null> {
    const row = (await db
      .from(RULE_SETS_TABLE)
      .where('user_id', userId)
      .select('revision', 'document', 'content_hash', 'updated_at', 'updated_by_device_id')
      .first()) as Row | null
    if (!row) return null
    return {
      revision: row.revision,
      document: row.document,
      contentHash: row.content_hash,
      updatedAt: row.updated_at,
      updatedByDeviceId: row.updated_by_device_id,
    }
  }

  async revisionOf(userId: number): Promise<number> {
    const row = (await db
      .from(RULE_SETS_TABLE)
      .where('user_id', userId)
      .select('revision')
      .first()) as { revision: number } | null
    return row?.revision ?? NO_RULE_SET_REVISION
  }

  async compareAndSwap(
    userId: number,
    expected: number,
    write: RuleSetWrite
  ): Promise<CompareAndSwap> {
    const document = JSON.stringify(write.document)
    const written =
      expected === NO_RULE_SET_REVISION
        ? await this.insertFirst(userId, document, write)
        : await this.updateFrom(userId, expected, document, write)
    if (written.length === 1) return { ok: true, revision: written[0].revision }
    return { ok: false, current: await this.revisionOf(userId) }
  }

  protected async insertFirst(userId: number, document: string, write: RuleSetWrite) {
    const at = write.now.toJSDate()
    const result = await db.rawQuery<{ rows: Array<{ revision: number }> }>(
      `INSERT INTO ${RULE_SETS_TABLE}
         (user_id, revision, document, content_hash, updated_by_device_id, created_at, updated_at)
       VALUES (?, 1, ?::jsonb, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING revision`,
      [userId, document, write.contentHash, write.deviceId, at, at]
    )
    return result.rows
  }

  protected async updateFrom(
    userId: number,
    expected: number,
    document: string,
    write: RuleSetWrite
  ) {
    const rows = await db
      .from(RULE_SETS_TABLE)
      .where('user_id', userId)
      .where('revision', expected)
      .update({
        revision: expected + 1,
        document: db.raw('?::jsonb', [document]),
        content_hash: write.contentHash,
        updated_by_device_id: write.deviceId,
        updated_at: write.now.toJSDate(),
      })
      .returning(['revision'])
    return rows as Array<{ revision: number }>
  }
}
