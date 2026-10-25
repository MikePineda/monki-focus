// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHmac, timingSafeEqual } from 'node:crypto'

/** RFC 6238 parameters every authenticator app supports: HMAC-SHA1, 6 digits, 30 s. */
export const TOTP_PERIOD_SECONDS = 30
export const TOTP_DIGITS = 6
/** Steps accepted on each side of the current one (clock drift). */
export const TOTP_WINDOW = 1

/** The time step that contains `unixSeconds`. */
export function totpStep(unixSeconds: number): number {
  return Math.floor(unixSeconds / TOTP_PERIOD_SECONDS)
}

/** RFC 4226 HOTP value for one counter, zero-padded to `digits`. */
export function hotp(secret: Uint8Array, counter: number, digits = TOTP_DIGITS): string {
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac('sha1', secret).update(message).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3]
  return String(binary % 10 ** digits).padStart(digits, '0')
}

/** The TOTP code shown at `unixSeconds`. */
export function totpCode(secret: Uint8Array, unixSeconds: number, digits = TOTP_DIGITS): string {
  return hotp(secret, totpStep(unixSeconds), digits)
}

function sameCode(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * The step a submitted code matches within ±TOTP_WINDOW of `unixSeconds`,
 * or null. A step at or before `lastUsedStep` never matches again, so a
 * code (or an older one) cannot be replayed. Spaces in the input are
 * ignored; anything but 6 digits fails.
 */
export function matchTotpStep(
  secret: Uint8Array,
  submitted: string,
  unixSeconds: number,
  lastUsedStep: number | null
): number | null {
  const code = submitted.replace(/\s/g, '')
  if (!/^\d{6}$/.test(code)) return null

  const current = totpStep(unixSeconds)
  let matched: number | null = null
  // Every candidate is checked (no early exit), so timing does not reveal which one matched.
  for (let step = current - TOTP_WINDOW; step <= current + TOTP_WINDOW; step++) {
    const fresh = lastUsedStep === null || step > lastUsedStep
    if (sameCode(hotp(secret, step), code) && fresh && matched === null) matched = step
  }
  return matched
}
