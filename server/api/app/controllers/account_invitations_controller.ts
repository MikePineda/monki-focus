// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import Clock from '#services/clock'
import { clientIp } from '#http/client_ip'
import { acceptInvitationValidator } from '#validators/invitations'
import { userResource } from '#transformers/user_transformer'
import GuardianOnlyLift from '#services/accounts/guardian_only_lift'

@inject()
export default class AccountInvitationsController {
  constructor(
    protected lift: GuardianOnlyLift,
    protected clock: Clock
  ) {}

  /**
   * POST /me/invitation: `{ invitation }` (the link's fragment). A
   * guardian-only account becomes an ordinary one; `{ user }` either way.
   */
  async accept(ctx: HttpContext) {
    const { invitation } = await ctx.request.validateUsing(acceptInvitationValidator)
    const user = await this.lift.lift(
      ctx.auth.use('web').getUserOrFail(),
      invitation,
      clientIp(ctx),
      this.clock.now()
    )
    return { user: userResource(user) }
  }
}
