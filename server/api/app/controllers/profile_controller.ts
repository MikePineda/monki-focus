// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { userResource } from '#transformers/user_transformer'
import ProfileService from '#services/accounts/profile_service'
import PasswordReauth from '#services/accounts/password_reauth'
import { refreshSessionVersion } from '#services/accounts/web_session'
import { changePasswordValidator, updateProfileValidator } from '#validators/profile'

@inject()
export default class ProfileController {
  constructor(
    protected profile: ProfileService,
    protected reauth: PasswordReauth
  ) {}

  /** PATCH /me: name, language, IANA time zone and week start. */
  async update({ auth, request }: HttpContext) {
    const changes = await request.validateUsing(updateProfileValidator)
    const user = await this.profile.update(auth.getUserOrFail(), changes)
    return { user: userResource(user) }
  }

  /**
   * PUT /me/password: the current password (throttled re-check), then the
   * new one. Every other session ends; this one stays signed in.
   */
  async password(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const { currentPassword, password } = await ctx.request.validateUsing(changePasswordValidator, {
      meta: { email: user.email },
    })

    await this.reauth.confirm(user, currentPassword)
    await this.profile.changePassword(user, password)
    refreshSessionVersion(ctx, user)
    return ctx.response.noContent()
  }
}
