// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import Clock from '#services/clock'
import { clientIp } from '#http/client_ip'
import { registerGuardianValidator } from '#validators/guardians'
import { userResource } from '#transformers/user_transformer'
import { startWebSession } from '#services/accounts/web_session'
import GuardianRegistration from '#services/guardians/guardian_registration'
import GuardianLinkRegistry from '#services/guardians/guardian_link_registry'

@inject()
export default class GuardianRegistrationsController {
  constructor(
    protected registration: GuardianRegistration,
    protected links: GuardianLinkRegistry,
    protected clock: Clock
  ) {}

  /**
   * POST /auth/register-guardian: a ward's pairing code opens a sign-up
   * even while REGISTRATION_OPEN is off, for that guardian link only.
   * Signs the new user in; 201 `{ user, link }` (pending). Every refusal is
   * the same 400 `E_GUARDIAN_REGISTRATION_REJECTED`.
   */
  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(registerGuardianValidator)
    const now = this.clock.now()
    const { user, link } = await this.registration.register(input, clientIp(ctx), now)

    await startWebSession(ctx, user)
    return ctx.response.created({
      user: userResource(user),
      link: await this.links.presentOne({ link, role: 'guardian' }, now),
    })
  }
}
