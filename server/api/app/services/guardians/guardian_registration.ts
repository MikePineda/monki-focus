// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import type GuardianLink from '#models/guardian_link'
import { CodedError } from '#exceptions/coded_error'
import type { SupportedLocale } from '#http/supported_locales'
import { throttleFailures } from '#services/accounts/failure_throttle'
import { pairingGuessRules } from '#services/guardians/guardian_throttles'
import GuardianLinkRegistry from '#services/guardians/guardian_link_registry'
import PairingCodeReservation from '#services/guardians/pairing_code_reservation'

export interface GuardianRegistrationInput {
  readonly code: string
  readonly email: string
  readonly fullName: string
  readonly password: string
  readonly locale?: SupportedLocale
  readonly timeZone?: string
  readonly weekStart?: number
}

/** Postgres unique_violation: lost a race for the same email. */
const PG_UNIQUE_VIOLATION = '23505'

function rejected() {
  return new CodedError('E_GUARDIAN_REGISTRATION_REJECTED', 400, 'This sign-up is not possible')
}

/**
 * `POST /auth/register-guardian`: the one sign-up that works while
 * REGISTRATION_OPEN is off, and only for this: a ward's valid pairing code
 * creates an ordinary (never admin) account and its **pending** link to
 * that ward, consuming the code, in one transaction. The account gets no
 * other privilege; the link grants nothing until the guardian turns on
 * two-step verification and the ward confirms them.
 *
 * The guess is paid for first (per-IP failure throttle, then the code's
 * own counter). Every refusal (wrong, expired, used or locked code, an
 * email already registered, a lost race) answers the same 400
 * `E_GUARDIAN_REGISTRATION_REJECTED` after hashing the password like a
 * success would, so neither the body nor the timing tells which.
 */
@inject()
export default class GuardianRegistration {
  constructor(
    protected codes: PairingCodeReservation,
    protected links: GuardianLinkRegistry
  ) {}

  async register(
    input: GuardianRegistrationInput,
    ip: string,
    now: DateTime
  ): Promise<{ user: User; link: GuardianLink }> {
    try {
      const reserved = await throttleFailures(pairingGuessRules(ip), () =>
        this.codes.reserve(input.code, now)
      )
      return await db.transaction(async (trx) => {
        await this.codes.lockForUse(trx, reserved, now)
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
        const link = await this.links.createPending(trx, reserved.wardUserId, user.id)
        await this.codes.markUsed(trx, reserved, { userId: user.id, linkId: link.id }, now)
        return { user, link }
      })
    } catch (error) {
      const raceLost = (error as { code?: unknown }).code === PG_UNIQUE_VIOLATION
      // Throttled (429) and unexpected errors keep their own answer.
      if (!(error instanceof CodedError) && !raceLost) throw error
      await hash.make(input.password)
      throw rejected()
    }
  }
}
