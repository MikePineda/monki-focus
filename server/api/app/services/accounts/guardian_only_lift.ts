// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'
import RegistrationService from '#services/accounts/registration_service'
import { registrationRules } from '#services/accounts/account_throttles'
import { throttleFailures } from '#services/accounts/failure_throttle'

/**
 * `POST /me/invitation`: a guardian-only account (made through a pairing
 * code) redeems an admin's invitation and becomes an ordinary account for
 * good. The invitation is checked exactly like at sign-up (7 days, single
 * use, its email if it names one), locked and consumed in the transaction
 * that lifts the flag; refusals are the sign-up's 400
 * `E_REGISTRATION_REJECTED`, throttled per IP like sign-ups. An ordinary
 * account has nothing to lift: the invitation is not even looked at.
 */
@inject()
export default class GuardianOnlyLift {
  constructor(protected registration: RegistrationService) {}

  async lift(user: User, secret: string, ip: string, now: DateTime): Promise<User> {
    if (!user.guardianOnly) return user
    return throttleFailures(registrationRules(ip), () =>
      db.transaction(async (trx) => {
        const invitation = await this.registration.lockUsableInvitation(
          secret,
          user.email,
          now,
          trx
        )
        invitation.usedAt = now
        invitation.usedByUserId = user.id
        await invitation.save()
        user.useTransaction(trx)
        user.guardianOnly = false
        await user.save()
        return user
      })
    )
  }
}
