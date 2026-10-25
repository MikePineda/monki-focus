// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import env from '#start/env'
import User from '#models/user'
import Invitation from '#models/invitation'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import { CodedError } from '#exceptions/coded_error'
import type { SupportedLocale } from '#http/supported_locales'
import { oneWayDigest } from '#domain/accounts/one_way_digest'
import { invitationStatus } from '#domain/accounts/invitation_window'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export interface RegistrationInput {
  /** The secret part of an invitation link, when there is one. */
  invitation?: string
  email: string
  fullName: string
  password: string
  locale?: SupportedLocale
  timeZone?: string
  weekStart?: number
}

/** Postgres unique_violation: lost a race for the same email. */
const PG_UNIQUE_VIOLATION = '23505'

/**
 * Creates an account. Registration is closed unless REGISTRATION_OPEN is
 * on; an admin's invitation always works (7 days, single use, its email if
 * it names one). The invitation is locked, checked and consumed in the
 * transaction that creates the user, so two people cannot use one link.
 *
 * Every refusal (closed registration, unknown, expired or used link, wrong
 * email, an email already registered) answers the same 400
 * `E_REGISTRATION_REJECTED` after hashing the password like a success
 * would: neither the body nor the timing reveals which accounts exist.
 */
export default class RegistrationService {
  async register(input: RegistrationInput, now: DateTime): Promise<User> {
    try {
      return await db.transaction(async (trx) => {
        const invitation = input.invitation
          ? await this.lockUsableInvitation(input.invitation, input.email, now, trx)
          : null
        if (!invitation && env.get('REGISTRATION_OPEN') !== true) throw rejected()

        const taken = await User.query({ client: trx }).where('email', input.email).first()
        if (taken) throw rejected()

        const user = await User.create(
          {
            email: input.email,
            fullName: input.fullName,
            password: input.password,
            locale: input.locale ?? 'en',
            timeZone: input.timeZone ?? 'UTC',
            weekStart: input.weekStart ?? 1,
            isAdmin: false,
            sessionVersion: 0,
          },
          { client: trx }
        )

        if (invitation) {
          invitation.usedAt = now
          invitation.usedByUserId = user.id
          await invitation.save()
        }
        return user
      })
    } catch (error) {
      const raceLost = (error as { code?: unknown }).code === PG_UNIQUE_VIOLATION
      if (!(error instanceof CodedError) && !raceLost) throw error
      // Same cost as the hashing a successful sign-up does.
      await hash.make(input.password)
      throw rejected()
    }
  }

  protected async lockUsableInvitation(
    secretPart: string,
    email: string,
    now: DateTime,
    trx: TransactionClientContract
  ) {
    const invitation = await Invitation.query({ client: trx })
      .where('token_hash', oneWayDigest(secretPart))
      .forUpdate()
      .first()
    if (!invitation) throw rejected()

    const status = invitationStatus(
      { expiresAt: invitation.expiresAt.toJSDate(), usedAt: invitation.usedAt?.toJSDate() ?? null },
      now.toJSDate()
    )
    if (status !== 'pending') throw rejected()
    if (invitation.email && invitation.email.toLowerCase() !== email.toLowerCase()) {
      throw rejected()
    }
    return invitation
  }
}

function rejected() {
  return new CodedError('E_REGISTRATION_REJECTED', 400, 'This sign-up is not possible')
}
