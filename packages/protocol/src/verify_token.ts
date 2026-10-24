// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Verifies a monki-focus unlock, policy or time token. The order is
 * normative and every platform follows it, so all of them return the same
 * code for the same vector:
 *
 *    1. inputs (keyring of the right purpose, issuer, device, nonce/boot, now) invalid_input
 *    2. a string of at most 4096 bytes, all in 0x21-0x7E                  malformed_token
 *    3. header is exactly `v4.public.`                                   wrong_header
 *    4. one body part and one footer part, strict base64url, body >= 64   malformed_token / malformed_base64url
 *    5. footer is exactly `{"kid":"<16 chars>"}`                          malformed_footer
 *    6. kid is in the pinned keyring                                     unknown_kid
 *    7. strict Ed25519 over PAE(header, message, footer, assertion)       invalid_signature
 *    --- nothing below runs on unauthenticated bytes ---
 *    8. message is a strict UTF-8 JSON object                             invalid_claims
 *    9. `typ` equals the purpose                                         wrong_typ
 *   10. message is byte-identical to the canonical serialisation          invalid_claims
 *   11. claims match the schema                                          invalid_claims
 *   12. `iss` / `dev` (and `nonce` / `boot`) equal the expected values    issuer_mismatch / device_mismatch / binding_mismatch
 *   13. `iat <= nbf < exp`                                               invalid_claims
 *   14. `exp - iat` within the purpose lifetime                           lifetime_too_long
 *   15. purpose rules (unlock: `dur_s <= exp - iat`)                     invalid_claims
 *   16. trusted now in `[nbf - 60 s, exp + 60 s]`                         not_yet_valid / expired
 *
 * Time tokens stop after step 12: they have no validity window; their
 * freshness comes from the nonce (see `trusted_time.ts`).
 *
 * The functions never throw: any unexpected exception becomes
 * `internal_error`, which callers treat like every other rejection.
 */
import {
  canonicalPolicyMessage,
  canonicalTimeMessage,
  canonicalUnlockMessage,
} from './canonical_claims.ts'
import { checkClaimTimes, checkTimeWindow, type ClaimTimes } from './claim_times.ts'
import { constantTimeEqual } from './constant_time_equal.ts'
import {
  implicitAssertion,
  type AssertionBinding,
  type IssuerProfile,
} from './implicit_assertion.ts'
import { isKeyring, lookupKey, type Keyring } from './keyring.ts'
import { parseKidFooter } from './kid_footer.ts'
import { isPolicyClaims, type PolicyClaims } from './policy_claims.ts'
import { isTimeClaims, type TimeClaims } from './time_claims.ts'
import { fail, ok, type Result } from './token_error.ts'
import { parseTokenParts } from './token_parts.ts'
import { TOKEN_PURPOSES, type TokenPurpose } from './token_purpose.ts'
import { isUnlockClaims, unlockDurationFits, type UnlockClaims } from './unlock_claims.ts'
import { verifyV4PublicParts } from './verify_v4_public.ts'

export interface VerificationContext {
  /** Keys pinned for this purpose (from enrolment or an endorsed rotation). */
  readonly keyring: Keyring
  /** The pinned canonical origin of the instance. */
  readonly issuer: string
  /** This device's uuid. */
  readonly device: string
  /** Trusted now, in whole epoch seconds. */
  readonly now: number
  /** Defaults to `release` (https issuers only). */
  readonly issuerProfile?: IssuerProfile
}

export interface TimeVerificationContext {
  /** The unlock keyring: time tokens are signed with the unlock key. */
  readonly keyring: Keyring
  readonly issuer: string
  readonly device: string
  /** The nonce this device sent with the request. */
  readonly nonce: string
  /** This device's current boot id, sent with the request. */
  readonly boot: string
  readonly issuerProfile?: IssuerProfile
}

export interface VerifiedToken<C> {
  readonly claims: C
  readonly kid: string
  readonly times: ClaimTimes
}

export interface VerifiedTimeToken {
  readonly claims: TimeClaims
  readonly kid: string
}

const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

function decodeMessage(message: Uint8Array): { text: string; value: object } | undefined {
  try {
    const text = utf8.decode(message)
    const value: unknown = JSON.parse(text)
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? { text, value }
      : undefined
  } catch {
    return undefined
  }
}

interface AuthenticatedClaims<C> {
  readonly claims: C
  readonly kid: string
}

/** Steps 1 to 12, shared by every purpose. */
function authenticate<C extends { readonly iss: string; readonly dev: string }>(
  purpose: TokenPurpose,
  isClaims: (value: unknown) => value is C,
  canonical: (value: unknown) => string | null,
  token: unknown,
  keyring: Keyring,
  binding: AssertionBinding,
  profile: IssuerProfile | undefined
): Result<AuthenticatedClaims<C>> {
  // 1. Inputs.
  if (!isKeyring(keyring) || keyring.purpose !== TOKEN_PURPOSES[purpose].keyPurpose) {
    return fail('invalid_input')
  }
  const assertion = implicitAssertion(purpose, binding, profile)
  if (!assertion.ok) {
    return assertion
  }

  // 2-4. Bytes, structure, header, base64url.
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
  const key = lookupKey(keyring, kid.value)
  if (!key.ok) {
    return key
  }

  // 7. Signature. Nothing before this point looked inside the message.
  const verified = verifyV4PublicParts(parts.value, key.value, assertion.value)
  if (!verified.ok) {
    return verified
  }

  // 8-11. Claims, only now that they are authenticated.
  const decoded = decodeMessage(verified.value.message)
  if (decoded === undefined) {
    return fail('invalid_claims')
  }
  if ((decoded.value as { typ?: unknown }).typ !== TOKEN_PURPOSES[purpose].typ) {
    return fail('wrong_typ')
  }
  const expected = canonical(decoded.value)
  const encoder = new TextEncoder()
  if (expected === null || !constantTimeEqual(encoder.encode(expected), verified.value.message)) {
    return fail('invalid_claims')
  }
  if (!isClaims(decoded.value)) {
    return fail('invalid_claims')
  }
  const claims = decoded.value

  // 12. Binding (also enforced by the implicit assertion).
  if (claims.iss !== binding.issuer) {
    return fail('issuer_mismatch')
  }
  if (claims.dev !== binding.device) {
    return fail('device_mismatch')
  }
  return ok({ claims, kid: kid.value })
}

function verifyWindowed<C extends UnlockClaims | PolicyClaims>(
  purpose: 'unlock' | 'policy',
  isClaims: (value: unknown) => value is C,
  canonical: (value: unknown) => string | null,
  fitsTimes: (claims: C, times: ClaimTimes) => boolean,
  token: unknown,
  context: VerificationContext
): Result<VerifiedToken<C>> {
  if (!Number.isSafeInteger(context.now)) {
    return fail('invalid_input')
  }
  const authenticated = authenticate(
    purpose,
    isClaims,
    canonical,
    token,
    context.keyring,
    { issuer: context.issuer, device: context.device },
    context.issuerProfile
  )
  if (!authenticated.ok) {
    return authenticated
  }
  const { claims, kid } = authenticated.value

  // 13-16. Time rules.
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
  return ok({ claims, kid, times: times.value })
}

export function verifyUnlockToken(
  token: unknown,
  context: VerificationContext
): Result<VerifiedToken<UnlockClaims>> {
  try {
    return verifyWindowed(
      'unlock',
      isUnlockClaims,
      canonicalUnlockMessage,
      unlockDurationFits,
      token,
      context
    )
  } catch {
    return fail('internal_error')
  }
}

export function verifyPolicyToken(
  token: unknown,
  context: VerificationContext
): Result<VerifiedToken<PolicyClaims>> {
  try {
    return verifyWindowed(
      'policy',
      isPolicyClaims,
      canonicalPolicyMessage,
      () => true,
      token,
      context
    )
  } catch {
    return fail('internal_error')
  }
}

export function verifyTimeToken(
  token: unknown,
  context: TimeVerificationContext
): Result<VerifiedTimeToken> {
  try {
    const authenticated = authenticate(
      'time',
      isTimeClaims,
      canonicalTimeMessage,
      token,
      context.keyring,
      {
        issuer: context.issuer,
        device: context.device,
        nonce: context.nonce,
        boot: context.boot,
      },
      context.issuerProfile
    )
    if (!authenticated.ok) {
      return authenticated
    }
    const { claims, kid } = authenticated.value
    if (claims.nonce !== context.nonce || claims.boot !== context.boot) {
      return fail('binding_mismatch')
    }
    return ok({ claims, kid })
  } catch {
    return fail('internal_error')
  }
}
