// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { CLOCK_SKEW_SECONDS } from '@monki-focus/protocol'

/**
 * Stores `expired` on every pending request past its deadline and clears
 * its action hashes. Decisions already refuse such a request (the state
 * machine reads the deadline), so this only writes the final state. One
 * UPDATE: a decision holding the row waits it out and is re-checked.
 * The same tick drops sealed unlock tokens that can no longer be used.
 */
export default class UnlockRequestExpiry {
  async expireDue(now: DateTime): Promise<number> {
    const at = now.toJSDate()
    const rows = await db
      .from('unlock_requests')
      .where('status', 'pending')
      .where('expires_at', '<=', at)
      .update({
        status: 'expired',
        approve_action_hash: null,
        deny_action_hash: null,
        action_expires_at: null,
        updated_at: at,
      })
    await this.dropUnusableTokens(now)
    return Array.isArray(rows) ? rows.length : Number(rows)
  }

  /**
   * Clears the sealed unlock token of every request whose ledger row was
   * revoked or can no longer be used (`exp` + 60 s skew passed): the poll
   * would not hand it out anyway, so the ciphertext is not kept.
   */
  async dropUnusableTokens(now: DateTime): Promise<void> {
    const unusableBefore = now.minus({ seconds: CLOCK_SKEW_SECONDS }).toJSDate()
    await db
      .from('unlock_requests')
      .whereNotNull('token_sealed')
      .whereIn('uuid', (tokens) =>
        tokens
          .from('unlock_tokens')
          .select('request_uuid')
          .where((unusable) =>
            unusable.whereNotNull('revoked_at').orWhere('expires_at', '<', unusableBefore)
          )
      )
      .update({ token_sealed: null, updated_at: now.toJSDate() })
  }
}
