// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

/**
 * Stores `expired` on every pending request past its deadline and clears
 * its action hashes. Decisions already refuse such a request (the state
 * machine reads the deadline), so this only writes the final state. One
 * UPDATE: a decision holding the row waits it out and is re-checked.
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
    return Array.isArray(rows) ? rows.length : Number(rows)
  }
}
