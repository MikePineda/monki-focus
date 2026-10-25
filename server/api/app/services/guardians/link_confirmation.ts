// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import type GuardianLink from '#models/guardian_link'
import { CodedError } from '#exceptions/coded_error'
import { activationRefusal } from '#domain/guardians/link_activation'
import PasswordReauth from '#services/accounts/password_reauth'
import GuardianLinkEvents from '#services/guardians/guardian_link_events'
import GuardianLinkRegistry from '#services/guardians/guardian_link_registry'

/**
 * `POST /guardian/links/:id/confirm`: the ward lets the guardian in. Only
 * the ward of a pending link reaches it (anyone else: 404), with their
 * password again (a stolen session alone cannot add a guardian), and only
 * once the guardian has two-step verification on. The link turns active in
 * a transaction that locks it and stores `guardian_linked` in the ward's
 * log.
 */
@inject()
export default class LinkConfirmation {
  constructor(
    protected links: GuardianLinkRegistry,
    protected reauth: PasswordReauth,
    protected events: GuardianLinkEvents
  ) {}

  async confirm(
    ward: User,
    linkId: number,
    password: string,
    now: DateTime
  ): Promise<GuardianLink> {
    await this.links.findLive(ward, linkId, 'ward', now)
    await this.reauth.confirm(ward, password)

    return db.transaction(async (trx) => {
      const link = await this.links.findLive(ward, linkId, 'ward', now, { trx, forUpdate: true })
      const guardian = await User.query({ client: trx })
        .where('id', link.guardianUserId)
        .firstOrFail()
      const refusal = activationRefusal({
        state: link.stateAt(now),
        guardianTwoFactorEnabled: guardian.twoFactorEnabled,
      })
      if (refusal === 'not_pending') {
        throw new CodedError('E_GUARDIAN_LINK_NOT_PENDING', 409, 'The link is not pending')
      }
      if (refusal === 'guardian_two_factor_required') {
        throw new CodedError('E_GUARDIAN_TWO_FACTOR_REQUIRED', 409, 'Guardians need 2FA')
      }

      link.status = 'active'
      link.confirmedAt = now
      await link.useTransaction(trx).save()
      await this.events.record(trx, link, 'guardian_linked', {}, now)
      return link
    })
  }
}
