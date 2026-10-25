// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import Clock from '#services/clock'
import { clientIp } from '#http/client_ip'
import { reauthValidator } from '#validators/profile'
import PasswordReauth from '#services/accounts/password_reauth'
import TwoFactorService from '#services/accounts/two_factor_service'
import Guardianship from '#services/guardians/guardianship'
import { CodedError } from '#exceptions/coded_error'
import db from '@adonisjs/lucid/services/db'
import { lockUserRows } from '#services/database/user_row_locks'
import { refreshSessionVersion } from '#services/accounts/web_session'
import { twoFactorRules } from '#services/accounts/account_throttles'
import { throttleFailures } from '#services/accounts/failure_throttle'
import { confirmTwoFactorValidator, twoFactorReauthValidator } from '#validators/two_factor'

/**
 * TOTP settings of the signed-in user. Starting an enrolment re-checks the
 * password; turning it off or regenerating recovery codes needs the
 * password and a second factor. Every code check is throttled per user.
 */
@inject()
export default class TwoFactorController {
  constructor(
    protected twoFactor: TwoFactorService,
    protected reauth: PasswordReauth,
    protected guardianship: Guardianship,
    protected clock: Clock
  ) {}

  /** POST /me/two-factor: a new seed and its otpauth:// URI (for the QR code). */
  async store({ auth, request }: HttpContext) {
    const { password } = await request.validateUsing(reauthValidator)
    const user = auth.use('web').getUserOrFail()
    await this.reauth.confirm(user, password)
    return this.twoFactor.begin(user)
  }

  /** POST /me/two-factor/confirm: activates TOTP and returns the recovery codes once. */
  async confirm(ctx: HttpContext) {
    const { code } = await ctx.request.validateUsing(confirmTwoFactorValidator)
    const user = ctx.auth.use('web').getUserOrFail()
    const recoveryCodes = await throttleFailures(twoFactorRules(user.id, clientIp(ctx)), () =>
      this.twoFactor.confirm(user, code, this.clock.now())
    )
    // Other sessions predate the second factor and end; this one stays.
    refreshSessionVersion(ctx, user)
    return { recoveryCodes }
  }

  /** POST /me/two-factor/recovery-codes: a fresh set; the old codes stop working. */
  async recoveryCodes(ctx: HttpContext) {
    const user = await this.reauthenticate(ctx)
    return { recoveryCodes: await this.twoFactor.regenerateRecoveryCodes(user, this.clock.now()) }
  }

  /**
   * DELETE /me/two-factor: turns TOTP off. Refused (409) while the user
   * guards someone: guardianship needs a second factor for as long as it
   * lasts (leave the link first).
   */
  async destroy(ctx: HttpContext) {
    const signedIn = ctx.auth.use('web').getUserOrFail()
    // A cheap early answer before the password and code are spent...
    if (await this.guardianship.isGuarding(signedIn, this.clock.now())) throw guardianNeedsIt()
    const user = await this.reauthenticate(ctx)
    // ...and the real check, under the users-row lock link confirmation
    // also takes (link_confirmation.ts): the two serialise, so no link can
    // turn active between the check and the change.
    await db.transaction(async (trx) => {
      await lockUserRows(trx, [{ id: user.id, mode: 'no key update' }])
      if (await this.guardianship.isGuarding(user, this.clock.now(), trx)) throw guardianNeedsIt()
      await this.twoFactor.disable(user, trx)
    })
    return ctx.response.noContent()
  }

  protected async reauthenticate(ctx: HttpContext) {
    const { password, ...factor } = await ctx.request.validateUsing(twoFactorReauthValidator)
    const user = ctx.auth.use('web').getUserOrFail()
    await this.reauth.confirm(user, password)
    await throttleFailures(twoFactorRules(user.id, clientIp(ctx)), () =>
      this.twoFactor.verify(user, factor, this.clock.now())
    )
    return user
  }
}

function guardianNeedsIt() {
  return new CodedError('E_GUARDIAN_TWO_FACTOR_REQUIRED', 409, 'Guardians need 2FA')
}
