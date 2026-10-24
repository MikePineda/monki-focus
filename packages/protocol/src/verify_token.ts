// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Verifies a monki-focus unlock or policy token. The order is normative and
 * every platform follows it, so all of them return the same code for the
 * same vector:
 *
 *    1. inputs (keyring of the right purpose, issuer, device, trusted now)  invalid_input
 *    2. token is a string of at most 4096 characters                     malformed_token
 *    3. header is exactly `v4.public.`                                   wrong_header
 *    4. one body part and one footer part, strict base64url              malformed_token / malformed_base64url
 *    5. footer is exactly `{"kid":"<16 chars>"}`                          malformed_footer
 *    6. kid is in the pinned keyring                                     unknown_kid
 *    7. Ed25519 over PAE(header, message, footer, implicit assertion)    invalid_signature
 *    --- nothing below runs on unauthenticated bytes ---
 *    8. message is UTF-8 JSON object                                     invalid_claims
 *    9. `typ` equals the purpose                                         wrong_typ
 *   10. claims match the schema                                          invalid_claims
 *   11. `iss` / `dev` equal the pinned issuer / this device              issuer_mismatch / device_mismatch
 *   12. `iat <= nbf < exp`                                               invalid_claims
 *   13. `exp - iat` within the purpose lifetime                           lifetime_too_long
 *   14. purpose rules (unlock: `dur_s <= exp - iat`)                     invalid_claims
 *   15. trusted now in `[nbf - 60 s, exp + 60 s]`                         not_yet_valid / expired
 *
 * The function never throws: any unexpected exception becomes
 * `internal_error`, which callers treat like every other rejection.
 */
import { checkClaimTimes, checkTimeWindow, type ClaimTimes } from './claim_times.ts'
import { implicitAssertion } from './implicit_assertion.ts'
import { isKeyring, lookupKey, type Keyring } from './keyring.ts'
import { parseKidFooter } from './kid_footer.ts'
import { isPolicyClaims, type PolicyClaims } from './policy_claims.ts'
import { fail, ok, type Result } from './token_error.ts'
import { parseTokenParts } from './token_parts.ts'
import type { TokenPurpose } from './token_purpose.ts'
import { isUnlockClaims, unlockDurationFits, type UnlockClaims } from './unlock_claims.ts'
import { verifyV4PublicParts } from './verify_v4_public.ts'

export interface VerificationContext {
  /** Keys pinned for this purpose (from pairing or an endorsed rotation). */
  readonly keyring: Keyring
  /** The pinned canonical origin of the instance. */
  readonly issuer: string
  /** This device's uuid. */
  readonly device: string
  /** Trusted now, in whole epoch seconds. */
  readonly now: number
}

export interface VerifiedToken<C> {
  readonly claims: C
  readonly kid: string
  readonly times: ClaimTimes
}

const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

function parseJsonObject(message: Uint8Array): unknown {
  try {
    const value: unknown = JSON.parse(utf8.decode(message))
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : undefined
  } catch {
    return undefined
  }
}

interface PurposeRules<C> {
  readonly purpose: TokenPurpose
  readonly isClaims: (value: unknown) => value is C
  readonly fitsTimes: (claims: C, times: ClaimTimes) => boolean
}

const UNLOCK_RULES: PurposeRules<UnlockClaims> = {
  purpose: 'unlock',
  isClaims: isUnlockClaims,
  fitsTimes: unlockDurationFits,
}

const POLICY_RULES: PurposeRules<PolicyClaims> = {
  purpose: 'policy',
  isClaims: isPolicyClaims,
  fitsTimes: () => true,
}

function verifyToken<C extends UnlockClaims | PolicyClaims>(
  { purpose, isClaims, fitsTimes }: PurposeRules<C>,
  token: unknown,
  context: VerificationContext
): Result<VerifiedToken<C>> {
  // 1. Inputs.
  if (
    !isKeyring(context.keyring) ||
    context.keyring.purpose !== purpose ||
    !Number.isSafeInteger(context.now)
  ) {
    return fail('invalid_input')
  }
  const assertion = implicitAssertion(purpose, context.issuer, context.device)
  if (!assertion.ok) {
    return assertion
  }

  // 2-4. Structure, header, base64url.
  const parts = parseTokenParts(token)
  if (!parts.ok) {
    return parts
  }

  // 5-6. Footer and key selection.
  if (parts.value.footer.byteLength === 0) {
    return fail('malformed_footer')
  }
  const kid = parseKidFooter(parts.value.footer)
  if (!kid.ok) {
    return kid
  }
  const key = lookupKey(context.keyring, kid.value)
  if (!key.ok) {
    return key
  }

  // 7. Signature. Nothing before this point looked inside the message.
  const verified = verifyV4PublicParts(parts.value, key.value, assertion.value)
  if (!verified.ok) {
    return verified
  }

  // 8-10. Claims, only now that they are authenticated.
  const claims = parseJsonObject(verified.value.message)
  if (claims === undefined) {
    return fail('invalid_claims')
  }
  if ((claims as { typ?: unknown }).typ !== purpose) {
    return fail('wrong_typ')
  }
  if (!isClaims(claims)) {
    return fail('invalid_claims')
  }

  // 11. Binding (also enforced by the implicit assertion).
  if (claims.iss !== context.issuer) {
    return fail('issuer_mismatch')
  }
  if (claims.dev !== context.device) {
    return fail('device_mismatch')
  }

  // 12-15. Time rules.
  const times = checkClaimTimes(claims, purpose)
  if (!times.ok) {
    return times
  }
  if (!fitsTimes(claims, times.value)) {
    return fail('invalid_claims')
  }
  const window = checkTimeWindow(times.value, context.now)
  if (!window.ok) {
    return window
  }
  return ok({ claims, kid: kid.value, times: times.value })
}

export function verifyUnlockToken(
  token: unknown,
  context: VerificationContext
): Result<VerifiedToken<UnlockClaims>> {
  try {
    return verifyToken(UNLOCK_RULES, token, context)
  } catch {
    return fail('internal_error')
  }
}

export function verifyPolicyToken(
  token: unknown,
  context: VerificationContext
): Result<VerifiedToken<PolicyClaims>> {
  try {
    return verifyToken(POLICY_RULES, token, context)
  } catch {
    return fail('internal_error')
  }
}
