// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import Clock from '#services/clock'
import { clientIp } from '#http/client_ip'
import { registerValidator } from '#validators/auth'
import { userResource } from '#transformers/user_transformer'
import { startWebSession } from '#services/accounts/web_session'
import { registrationRules } from '#services/accounts/account_throttles'
import { throttleFailures } from '#services/accounts/failure_throttle'
import RegistrationService from '#services/accounts/registration_service'

@inject()
export default class RegistrationsController {
  constructor(
    protected registration: RegistrationService,
    protected clock: Clock
  ) {}

  /**
   * POST /auth/register: with an invitation (the link's fragment) or, only
   * while REGISTRATION_OPEN is on, without one. Signs the new user in.
   * Every refusal is the same 400 `E_REGISTRATION_REJECTED`; refusals are
   * throttled per IP (guessing links).
   */
  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(registerValidator)
    const user = await throttleFailures(registrationRules(clientIp(ctx)), () =>
      this.registration.register(input, this.clock.now())
    )

    await startWebSession(ctx, user)
    return ctx.response.created({ user: userResource(user) })
  }
}
