// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Time rules on `iat`, `nbf` and `exp`, applied after the schema check:
 *
 *   - `iat <= nbf < exp`, otherwise `invalid_claims`;
 *   - `exp - iat <= maxLifetime(purpose)`, otherwise `lifetime_too_long`;
 *   - trusted now in `[nbf - 60 s, exp + 60 s]`, otherwise `not_yet_valid`
 *     or `expired`.
 *
 * "Trusted now" is an input: the caller computes it (see `trusted_time.ts`).
 */
import { parseRfc3339Utc } from './rfc3339_utc.ts'
import { fail, ok, type Result } from './token_error.ts'
import { CLOCK_SKEW_SECONDS, TOKEN_PURPOSES, type TokenPurpose } from './token_purpose.ts'

export interface ClaimTimes {
  /** Epoch seconds. */
  readonly iat: number
  readonly nbf: number
  readonly exp: number
}

export function checkClaimTimes(
  claims: { readonly iat: string; readonly nbf: string; readonly exp: string },
  purpose: TokenPurpose
): Result<ClaimTimes> {
  const iat = parseRfc3339Utc(claims.iat)
  const nbf = parseRfc3339Utc(claims.nbf)
  const exp = parseRfc3339Utc(claims.exp)
  if (iat === null || nbf === null || exp === null || iat > nbf || nbf >= exp) {
    return fail('invalid_claims')
  }
  if (exp - iat > TOKEN_PURPOSES[purpose].maxLifetimeSeconds) {
    return fail('lifetime_too_long')
  }
  return ok({ iat, nbf, exp })
}

export function checkTimeWindow(times: ClaimTimes, trustedNow: number): Result<ClaimTimes> {
  if (trustedNow < times.nbf - CLOCK_SKEW_SECONDS) {
    return fail('not_yet_valid')
  }
  if (trustedNow > times.exp + CLOCK_SKEW_SECONDS) {
    return fail('expired')
  }
  return ok(times)
}
