// SPDX-License-Identifier: AGPL-3.0-or-later
import User from '#models/user'
import { loginRules } from '#services/accounts/account_throttles'
import { throttleFailures } from '#services/accounts/failure_throttle'

/**
 * The password step of a login. `verifyCredentials` answers an unknown email
 * and a wrong password with the same 400 `E_INVALID_CREDENTIALS` and hashes
 * a dummy value for unknown emails, so neither the body nor the timing tells
 * whether an account exists. Only failures count toward the throttles.
 */
export default class LoginService {
  async checkPassword(email: string, password: string, ip: string): Promise<User> {
    return throttleFailures(loginRules(ip, email), () => User.verifyCredentials(email, password))
  }
}
