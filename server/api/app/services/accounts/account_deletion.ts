// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import Clock from '#services/clock'
import { lockUserRows } from '#services/database/user_row_locks'
import { retryOnDeadlock } from '#services/database/deadlock_retry'
import LinkRevocationService from '#services/guardians/link_revocation_service'

/**
 * `DELETE /me`: removes the account and, through the foreign keys, every
 * row that hangs from it (ON DELETE CASCADE: invitations created, recovery
 * codes, scheduler runs, devices with their tokens, heartbeats and unlock
 * ledger rows, enrolment codes, bypass events, pairing codes, guardian
 * links on either side, queued notifications; invitations it accepted keep
 * existing with `used_by_user_id` null). In the same transaction, just
 * before: each guardian of this user gets a neutral `pairing_ended`
 * notice, and each ward this user guarded gets `guardian_unlinked` in
 * their log.
 *
 * Lock order (user_row_locks.ts): the account's row and the rows of the
 * people it is linked with first, in id order, then its links in one
 * ordered statement, then the cascade. Two linked accounts deleted at once,
 * or a deletion racing a pairing, then queue instead of deadlocking (a
 * deadlock would still be retried once). Logs the id only.
 */
@inject()
export default class AccountDeletion {
  constructor(
    protected links: LinkRevocationService,
    protected clock: Clock
  ) {}

  async delete(user: User): Promise<void> {
    const id = user.id
    const now = this.clock.now()
    const counterparts = await this.links.counterpartsOf(user, now)
    await retryOnDeadlock(() =>
      db.transaction(async (trx) => {
        await lockUserRows(trx, [
          { id, mode: 'update' },
          ...counterparts.map((other) => ({ id: other, mode: 'key share' as const })),
        ])
        await this.links.endForDeletedAccount(user, now, trx)
        await user.useTransaction(trx).delete()
      })
    )
    logger.info({ userId: id }, 'account deleted by its user')
  }
}
