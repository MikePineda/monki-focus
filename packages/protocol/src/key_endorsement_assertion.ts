// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Implicit assertion of a key endorsement token (spec §2 "Rotation"):
 *
 *   "monki-focus/key/v1|" + iss + "|" + purpose
 *
 * The verifier builds it from its own pinned issuer and the purpose of the
 * keyring it is about to extend, so an endorsement from another instance or
 * for the other purpose fails the signature. Neither value can contain "|".
 */
import { ISSUER_PATTERN, RELEASE_ISSUER_PATTERN } from './claim_formats.ts'
import type { IssuerProfile } from './implicit_assertion.ts'
import { KEY_ENDORSEMENT_ASSERTION_PREFIX } from './key_endorsement_claims.ts'
import { fail, ok, type Result } from './token_error.ts'
import type { KeyPurpose } from './token_purpose.ts'

export function keyEndorsementAssertionText(issuer: string, purpose: KeyPurpose): string {
  return [KEY_ENDORSEMENT_ASSERTION_PREFIX, issuer, purpose].join('|')
}

export function keyEndorsementAssertion(
  issuer: string,
  purpose: KeyPurpose,
  profile: IssuerProfile = 'release'
): Result<Uint8Array> {
  const issuerPattern = profile === 'development' ? ISSUER_PATTERN : RELEASE_ISSUER_PATTERN
  if (typeof issuer !== 'string' || !issuerPattern.test(issuer)) {
    return fail('invalid_input')
  }
  // Callers may come from untyped JSON; refuse anything but the two key purposes.
  if (!(['unlock', 'policy'] as readonly unknown[]).includes(purpose)) {
    return fail('invalid_input')
  }
  return ok(new TextEncoder().encode(keyEndorsementAssertionText(issuer, purpose)))
}
