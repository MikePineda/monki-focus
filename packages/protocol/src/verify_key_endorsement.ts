// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Verifies a key endorsement token (spec §2 "Rotation") against the keyring
 * a client already pins for one purpose. Same order as every other token
 * (spec §5), so all platforms return the same code:
 *
 *    1. inputs (a keyring from createKeyring, issuer, integer now)          invalid_input
 *    2-4. bytes, header, parts, strict base64url                           malformed_token / wrong_header / malformed_base64url
 *    5. footer is exactly `{"kid":"<16 chars>"}`                          malformed_footer
 *    6. kid is in the pinned keyring (the endorsing key)                  unknown_kid
 *    7. strict Ed25519 over PAE(header, message, footer, assertion),
 *       assertion "monki-focus/key/v1|" + issuer + "|" + keyring purpose   invalid_signature
 *    --- nothing below runs on unauthenticated bytes ---
 *    8. message is a strict UTF-8 JSON object                             invalid_claims
 *    9. `typ` is "key"                                                    wrong_typ
 *   10. message is byte-identical to the canonical serialisation          invalid_claims
 *   11. claims match the schema                                          invalid_claims
 *   12. `iss` equals the pinned issuer; `use` the keyring purpose          issuer_mismatch / binding_mismatch
 *   13. `x` is a strict key, `kid` is derived from it and differs from
 *       the endorsing kid                                                 invalid_claims
 *   14. `iat <= nbf < exp`                                               invalid_claims
 *   15. `exp - iat <= 90 days`                                           lifetime_too_long
 *   16. trusted now in `[nbf - 60 s, exp + 60 s]`                         not_yet_valid / expired
 *
 * Never throws; an unexpected exception is `internal_error`.
 */
import { decodeClaimsMessage } from './claims_message.ts'
import { canonicalKeyEndorsementMessage } from './canonical_claims.ts'
import { checkTimeWindow, type ClaimTimes } from './claim_times.ts'
import { constantTimeEqual } from './constant_time_equal.ts'
import type { IssuerProfile } from './implicit_assertion.ts'
import { keyEndorsementAssertion } from './key_endorsement_assertion.ts'
import { isKeyEndorsementClaims, type KeyEndorsementClaims } from './key_endorsement_claims.ts'
import { checkKeyEndorsementRules } from './key_endorsement_rules.ts'
import { isKeyring, lookupKey, type Keyring, type PinnedKey } from './keyring.ts'
import { parseKidFooter } from './kid_footer.ts'
import { fail, ok, type Result } from './token_error.ts'
import { parseTokenParts } from './token_parts.ts'
import { verifyV4PublicParts } from './verify_v4_public.ts'

export interface KeyEndorsementContext {
  /** The keys this client pins for the purpose being rotated. */
  readonly keyring: Keyring
  /** The pinned canonical origin of the instance. */
  readonly issuer: string
  /** Trusted now, in whole epoch seconds. */
  readonly now: number
  /** Defaults to `release` (https issuers only). */
  readonly issuerProfile?: IssuerProfile
}

export interface VerifiedKeyEndorsement {
  readonly claims: KeyEndorsementClaims
  /** Kid of the pinned key that signed the endorsement. */
  readonly endorserKid: string
  /** The endorsed key, ready to pin next to the endorser. */
  readonly endorsed: PinnedKey
  readonly times: ClaimTimes
}

function verify(token: unknown, context: KeyEndorsementContext): Result<VerifiedKeyEndorsement> {
  // 1. Inputs.
  if (!isKeyring(context.keyring) || !Number.isSafeInteger(context.now)) {
    return fail('invalid_input')
  }
  const purpose = context.keyring.purpose
  const assertion = keyEndorsementAssertion(context.issuer, purpose, context.issuerProfile)
  if (!assertion.ok) {
    return assertion
  }

  // 2-4. Bytes, structure, header, base64url.
  const parts = parseTokenParts(token)
  if (!parts.ok) {
    return parts
  }

  // 5-6. Footer and endorsing key.
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

  // 7. Signature.
  const verified = verifyV4PublicParts(parts.value, key.value, assertion.value)
  if (!verified.ok) {
    return verified
  }

  // 8-11. Claims, only now that they are authenticated.
  const decoded = decodeClaimsMessage(verified.value.message)
  if (decoded === undefined) {
    return fail('invalid_claims')
  }
  if ((decoded.value as { typ?: unknown }).typ !== 'key') {
    return fail('wrong_typ')
  }
  const expected = canonicalKeyEndorsementMessage(decoded.value)
  if (
    expected === null ||
    !constantTimeEqual(new TextEncoder().encode(expected), verified.value.message)
  ) {
    return fail('invalid_claims')
  }
  if (!isKeyEndorsementClaims(decoded.value)) {
    return fail('invalid_claims')
  }
  const claims = decoded.value

  // 12. Binding (also enforced by the implicit assertion).
  if (claims.iss !== context.issuer) {
    return fail('issuer_mismatch')
  }
  if (claims.use !== purpose) {
    return fail('binding_mismatch')
  }

  // 13-15. The endorsed key and the lifetime.
  const rules = checkKeyEndorsementRules(claims, kid.value)
  if (!rules.ok) {
    return rules
  }

  // 16. Validity window.
  const window = checkTimeWindow(rules.value.times, context.now)
  if (!window.ok) {
    return window
  }
  return ok({
    claims,
    endorserKid: kid.value,
    endorsed: { kid: claims.kid, publicKey: rules.value.publicKey },
    times: rules.value.times,
  })
}

export function verifyKeyEndorsement(
  token: unknown,
  context: KeyEndorsementContext
): Result<VerifiedKeyEndorsement> {
  try {
    return verify(token, context)
  } catch {
    return fail('internal_error')
  }
}
