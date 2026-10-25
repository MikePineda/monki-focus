// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Clock from '#services/clock'
import { clientIp } from '#http/client_ip'
import { CodedError } from '#exceptions/coded_error'
import { userResource } from '#transformers/user_transformer'
import LoginService from '#services/accounts/login_service'
import ProfileService from '#services/accounts/profile_service'
import TwoFactorService from '#services/accounts/two_factor_service'
import { startWebSession } from '#services/accounts/web_session'
import { twoFactorRules } from '#services/accounts/account_throttles'
import { throttleFailures } from '#services/accounts/failure_throttle'
import { loginValidator, twoFactorLoginValidator } from '#validators/auth'
import {
  closeChallenge,
  openChallenge,
  readChallenge,
} from '#services/accounts/two_factor_challenge'

@inject()
export default class SessionsController {
  constructor(
    protected login: LoginService,
    protected profile: ProfileService,
    protected twoFactor: TwoFactorService,
    protected clock: Clock
  ) {}

  /**
   * POST /auth/login. Wrong password and unknown email answer the same
   * 400 `E_INVALID_CREDENTIALS`. With TOTP on, the password step answers
   * `{ twoFactorRequired: true }` and nobody is logged in until
   * POST /auth/two-factor.
   */
  async store(ctx: HttpContext) {
    const { email, password } = await ctx.request.validateUsing(loginValidator)
    const user = await this.login.checkPassword(email, password, clientIp(ctx))

    if (user.twoFactorEnabled) {
      openChallenge(ctx, user, this.clock.now())
      return { twoFactorRequired: true }
    }

    closeChallenge(ctx)
    await startWebSession(ctx, user)
    return { twoFactorRequired: false, user: userResource(user) }
  }

  /** POST /auth/two-factor: the second login step (authenticator or recovery code). */
  async twoFactorStep(ctx: HttpContext) {
    const factor = await ctx.request.validateUsing(twoFactorLoginValidator)
    const now = this.clock.now()
    const challenge = readChallenge(ctx, now)
    const user = challenge ? await User.find(challenge.userId) : null
    if (!challenge || !user || user.sessionVersion !== challenge.sv || !user.twoFactorEnabled) {
      closeChallenge(ctx)
      throw new CodedError('E_TWO_FACTOR_CHALLENGE_EXPIRED', 400, 'Sign in again')
    }

    await throttleFailures(twoFactorRules(user.id, clientIp(ctx)), () =>
      this.twoFactor.verify(user, factor, now)
    )

    closeChallenge(ctx)
    await startWebSession(ctx, user)
    return { user: userResource(user) }
  }

  /** GET /auth/me: the dashboard's boot call. Guests get 401 (and the XSRF cookie). */
  async show({ auth }: HttpContext) {
    return { user: userResource(auth.getUserOrFail()) }
  }

  /** POST /auth/logout: ends this session only. */
  async destroy({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    return response.noContent()
  }

  /** POST /auth/logout-everywhere: bumps session_version, ending every session, this one too. */
  async destroyEverywhere({ auth, response }: HttpContext) {
    await this.profile.revokeAllSessions(auth.getUserOrFail())
    await auth.use('web').logout()
    return response.noContent()
  }
}
