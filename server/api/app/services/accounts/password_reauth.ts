// SPDX-License-Identifier: AGPL-3.0-or-later
import type User from '#models/user'
import { CodedError } from '#exceptions/coded_error'
import { reauthRules } from '#services/accounts/account_throttles'
import { throttleFailures } from '#services/accounts/failure_throttle'

/**
 * Re-authentication for sensitive actions of a signed-in user (password
 * change, account deletion, two-factor changes): the current password
 * again, throttled per user so a stolen session cannot guess it. A wrong
 * password answers 400 `E_REAUTH_FAILED`.
 */
export default class PasswordReauth {
  async confirm(user: User, password: string): Promise<void> {
    await throttleFailures(reauthRules(user.id), async () => {
      if (!(await user.verifyPassword(password))) {
        throw new CodedError('E_REAUTH_FAILED', 400, 'The password is not correct')
      }
    })
  }
}
