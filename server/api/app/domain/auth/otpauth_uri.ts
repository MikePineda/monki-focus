// SPDX-License-Identifier: AGPL-3.0-or-later
import { TOTP_DIGITS, TOTP_PERIOD_SECONDS } from '#domain/auth/totp'

/**
 * The `otpauth://totp/...` URI an authenticator app scans (Key Uri Format):
 * `issuer:account` label, the base32 secret and the RFC 6238 parameters.
 */
export function otpauthUri(input: { issuer: string; account: string; secret: string }): string {
  const label = `${encodeURIComponent(input.issuer)}:${encodeURIComponent(input.account)}`
  const query = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  })
  return `otpauth://totp/${label}?${query.toString()}`
}
