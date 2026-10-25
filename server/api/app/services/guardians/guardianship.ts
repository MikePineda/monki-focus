// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import { errors as lucidErrors } from '@adonisjs/lucid'
import type User from '#models/user'
import GuardianLink from '#models/guardian_link'
import { CodedError } from '#exceptions/coded_error'
import { ownedBy } from '#services/tenancy/owned_by'

/**
 * The only door from a guardian to a ward's data. It opens through an
 * **active** link (confirmed by the ward, revocation deadline not passed)
 * whose guardian has two-step verification on; anything else (no link,
 * pending, revoked, lapsed, someone else's ward, a guardian whose second
 * factor was turned off by an operator) is the same 404 as a missing row,
 * never a 403.
 */
export default class Guardianship {
  async activeLinkOrFail(guardian: User, wardUserId: number, now: DateTime): Promise<GuardianLink> {
    if (!guardian.twoFactorEnabled) throw new lucidErrors.E_ROW_NOT_FOUND()
    return this.granting(guardian, now).where('ward_user_id', wardUserId).firstOrFail()
  }

  /** Whether the user guards anyone right now (their second factor must then stay on). */
  async isGuarding(user: User, now: DateTime): Promise<boolean> {
    return (await this.granting(user, now).first()) !== null
  }

  /** Refuses a guardian-side action while the guardian has no second factor. */
  requireTwoFactor(guardian: User): void {
    if (!guardian.twoFactorEnabled) {
      throw new CodedError(
        'E_GUARDIAN_TWO_FACTOR_REQUIRED',
        409,
        'Guardians need two-step verification'
      )
    }
  }

  protected granting(guardian: User, now: DateTime) {
    return ownedBy(GuardianLink, guardian, 'guardian_user_id')
      .where('status', 'active')
      .where((deadline) =>
        deadline
          .whereNull('revocation_effective_at')
          .orWhere('revocation_effective_at', '>', now.toJSDate())
      )
  }
}
