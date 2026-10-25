// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import Clock from '#services/clock'
import AccountExport from '#services/accounts/account_export'
import AccountDeletion from '#services/accounts/account_deletion'
import PasswordReauth from '#services/accounts/password_reauth'
import { exportValidator, reauthValidator } from '#validators/profile'

@inject()
export default class AccountController {
  constructor(
    protected exporter: AccountExport,
    protected deletion: AccountDeletion,
    protected reauth: PasswordReauth,
    protected clock: Clock
  ) {}

  /** GET /me/export: the user's own data as a JSON download, never cached. */
  async export({ auth, request, response }: HttpContext) {
    await request.validateUsing(exportValidator, { data: request.qs() })
    const now = this.clock.now()
    const document = await this.exporter.build(auth.use('web').getUserOrFail(), now)

    response.header('Cache-Control', 'no-store')
    response.header(
      'Content-Disposition',
      `attachment; filename="monki-focus-export-${now.toUTC().toISODate()}.json"`
    )
    return document
  }

  /** DELETE /me: the password again, then the account and everything under it are gone. */
  async destroy({ auth, request, response }: HttpContext) {
    const { password } = await request.validateUsing(reauthValidator)
    const user = auth.use('web').getUserOrFail()

    await this.reauth.confirm(user, password)
    await auth.use('web').logout()
    await this.deletion.delete(user)
    return response.noContent()
  }
}
