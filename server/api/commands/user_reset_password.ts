// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomBytes } from 'node:crypto'
import { args, BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { passwordProblems } from '#domain/accounts/password_policy'

/**
 * `node ace user:reset-password <email>`: the server has no mail, so this
 * is how an operator resets a password (`docker exec <container> node ace
 * user:reset-password <email>`). Asks for the new password twice, or
 * `--generate`s one and prints it once. Signs the account out everywhere
 * (bumps session_version). `--disable-two-factor` also turns TOTP off for a
 * user who lost both the password and the authenticator. Prints the id,
 * never the email.
 */
export default class UserResetPassword extends BaseCommand {
  static commandName = 'user:reset-password'
  static description = 'Set a new password for an account and sign it out everywhere'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Email of the account' })
  declare email: string

  @flags.boolean({ description: 'Generate a strong password and print it once' })
  declare generate: boolean

  @flags.boolean({
    flagName: 'disable-two-factor',
    description: 'Also turn two-step verification off',
  })
  declare disableTwoFactor: boolean

  async run() {
    const { default: User } = await import('#models/user')
    const { default: TwoFactorService } = await import('#services/accounts/two_factor_service')

    const user = await User.query().where('email', this.email.trim().toLowerCase()).first()
    if (!user) {
      this.logger.error('No account has that email')
      this.exitCode = 1
      return
    }

    const password = this.generate ? generatePassword(user.email) : await this.askPassword()
    if (password === null) {
      this.exitCode = 1
      return
    }
    const problems = passwordProblems(password, { email: user.email })
    if (problems.length > 0) {
      this.logger.error(`The password is too weak (${problems.join(', ')}). Nothing changed`)
      this.exitCode = 1
      return
    }

    if (this.disableTwoFactor) await new TwoFactorService().disable(user)
    user.password = password
    user.sessionVersion += 1
    await user.save()

    this.logger.success(`Password reset for user #${user.id}; every session was signed out`)
    if (this.disableTwoFactor) this.logger.info('Two-step verification is now off')
    if (this.generate) this.logger.log(`New password (shown once): ${password}`)
  }

  protected async askPassword(): Promise<string | null> {
    const first = await this.prompt.secure('New password')
    const second = await this.prompt.secure('Repeat the new password')
    if (first !== second) {
      this.logger.error('The passwords do not match. Nothing changed')
      return null
    }
    return first
  }
}

/** 144 random bits as 24 base64url characters, redrawn in the (unlikely) case the policy refuses it. */
function generatePassword(email: string): string {
  for (;;) {
    const candidate = randomBytes(18).toString('base64url')
    if (passwordProblems(candidate, { email }).length === 0) return candidate
  }
}
