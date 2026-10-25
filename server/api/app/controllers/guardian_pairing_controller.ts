// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import Clock from '#services/clock'
import { clientIp } from '#http/client_ip'
import { redeemPairingValidator } from '#validators/guardians'
import PairingCodeService from '#services/guardians/pairing_code_service'
import PairingRedemption from '#services/guardians/pairing_redemption'
import GuardianLinkRegistry from '#services/guardians/guardian_link_registry'

/**
 * Pairing (dashboard, session + CSRF): the ward asks for a code, the
 * future guardian redeems it into a pending link.
 */
@inject()
export default class GuardianPairingController {
  constructor(
    protected codes: PairingCodeService,
    protected redemption: PairingRedemption,
    protected links: GuardianLinkRegistry,
    protected clock: Clock
  ) {}

  /**
   * POST /guardian/pairing-codes: 201 with the code (shown once, valid
   * PAIRING_CODE_TTL_MINUTES) and the QR payload (`<APP_URL>/pair#<code>`).
   */
  async storeCode({ auth, response }: HttpContext) {
    const issued = await this.codes.create(auth.use('web').getUserOrFail(), this.clock.now())
    response.header('Cache-Control', 'no-store')
    return response.created({
      code: issued.code,
      expiresAt: issued.expiresAt.toUTC().toISO(),
      qrPayload: issued.qrPayload,
    })
  }

  /** POST /guardian/pairings: `{ code }` → 201 `{ link }` (pending until the ward confirms). */
  async redeem(ctx: HttpContext) {
    const { code } = await ctx.request.validateUsing(redeemPairingValidator)
    const guardian = ctx.auth.use('web').getUserOrFail()
    const now = this.clock.now()
    const link = await this.redemption.redeem(guardian, code, clientIp(ctx), now)
    return ctx.response.created({
      link: await this.links.presentOne({ link, role: 'guardian' }, now),
    })
  }
}
