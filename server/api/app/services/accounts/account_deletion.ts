// SPDX-License-Identifier: AGPL-3.0-or-later
import type User from '#models/user'
import logger from '@adonisjs/core/services/logger'

/**
 * `DELETE /me`: removes the account and, through the foreign keys, every
 * row that hangs from it (ON DELETE CASCADE: invitations created, recovery
 * codes, scheduler runs, devices with their tokens, heartbeats and unlock
 * ledger rows, enrolment codes, bypass events; invitations it accepted keep
 * existing with `used_by_user_id` null). The guardian package hooks its notice in here:
 * deleting an account always tells an active guardian. Logs the id only.
 */
export default class AccountDeletion {
  async delete(user: User): Promise<void> {
    const id = user.id
    await user.delete()
    logger.info({ userId: id }, 'account deleted by its user')
  }
}
