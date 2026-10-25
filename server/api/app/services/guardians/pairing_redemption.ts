// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'
import type GuardianLink from '#models/guardian_link'
import { CodedError } from '#exceptions/coded_error'
import { pairingRefusal } from '#domain/guardians/pairing_eligibility'
import { throttleFailures } from '#services/accounts/failure_throttle'
import { pairingGuessRules } from '#services/guardians/guardian_throttles'
import GuardianLinkRegistry from '#services/guardians/guardian_link_registry'
import PairingCodeReservation, {
  invalidPairingCode,
} from '#services/guardians/pairing_code_reservation'
import { lockUserRows } from '#services/database/user_row_locks'
import { retryOnDeadlock } from '#services/database/deadlock_retry'

/**
 * `POST /guardian/pairings`: a signed-in person trades a ward's pairing
 * code for a **pending** link. The guess is paid for first (per-IP and
 * per-account failure throttles, then the code's own counter); a right
 * code for oneself or for a pair already linked is refused without being
 * used up. Nothing is granted until the ward confirms
 * (link_confirmation.ts).
 */
@inject()
export default class PairingRedemption {
  constructor(
    protected codes: PairingCodeReservation,
    protected links: GuardianLinkRegistry
  ) {}

  async redeem(guardian: User, code: string, ip: string, now: DateTime): Promise<GuardianLink> {
    const reserved = await throttleFailures(pairingGuessRules(ip, guardian.id), () =>
      this.codes.reserve(code, now)
    )

    return retryOnDeadlock(() =>
      db.transaction(async (trx) => {
        // Users first, then the code (user_row_locks.ts): never a cycle with a deletion.
        const present = await lockUserRows(trx, [
          { id: reserved.wardUserId, mode: 'key share' },
          { id: guardian.id, mode: 'key share' },
        ])
        if (!present.has(reserved.wardUserId)) throw invalidPairingCode()
        await this.codes.lockForUse(trx, reserved, now)
        const refusal = pairingRefusal({
          wardUserId: reserved.wardUserId,
          guardianUserId: guardian.id,
          pairAlreadyLinked: await this.links.pairIsLinked(
            reserved.wardUserId,
            guardian.id,
            now,
            trx
          ),
        })
        if (refusal === 'self') {
          throw new CodedError('E_PAIRING_WITH_SELF', 409, 'You cannot be your own guardian')
        }
        if (refusal === 'already_linked') {
          throw new CodedError('E_GUARDIAN_LINK_EXISTS', 409, 'Already linked')
        }

        const link = await this.links.createPending(trx, reserved.wardUserId, guardian.id, now)
        await this.codes.markUsed(trx, reserved, { userId: guardian.id, linkId: link.id }, now)
        return link
      })
    )
  }
}
