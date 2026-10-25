// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Server-side issuance of a key endorsement token (spec §2 "Rotation"): the
 * previous active key of a purpose signs the canonical claims about the new
 * key, with footer `{"kid":"<old kid>"}` and the implicit assertion
 * `"monki-focus/key/v1|" + iss + "|" + purpose`. Refuses anything a
 * verifier would reject on its claims and a signing key whose kid does not
 * match it.
 */
import { canonicalKeyEndorsementMessage } from './canonical_claims.ts'
import { isEd25519PrivateKey, rawPublicKey } from './ed25519_key.ts'
import type { IssuerProfile } from './implicit_assertion.ts'
import type { SigningKey } from './issue_token.ts'
import { keyEndorsementAssertion } from './key_endorsement_assertion.ts'
import { isKeyEndorsementClaims, type KeyEndorsementClaims } from './key_endorsement_claims.ts'
import { checkKeyEndorsementRules } from './key_endorsement_rules.ts'
import { deriveKeyId } from './key_id.ts'
import { encodeKidFooter } from './kid_footer.ts'
import { signV4Public } from './sign_v4_public.ts'
import { fail, ok, type Result } from './token_error.ts'

export interface IssueKeyEndorsementOptions {
  /** Defaults to `release` (https issuers only). */
  readonly profile?: IssuerProfile
}

export function issueKeyEndorsement(
  claims: KeyEndorsementClaims,
  endorsingKey: SigningKey,
  options: IssueKeyEndorsementOptions = {}
): Result<string> {
  try {
    if (!isKeyEndorsementClaims(claims)) {
      return fail('invalid_claims')
    }
    const rules = checkKeyEndorsementRules(claims, endorsingKey.kid)
    if (!rules.ok) {
      return rules
    }
    const message = canonicalKeyEndorsementMessage(claims)
    if (message === null) {
      return fail('invalid_claims')
    }
    if (
      !isEd25519PrivateKey(endorsingKey.secretKey) ||
      deriveKeyId(rawPublicKey(endorsingKey.secretKey)) !== endorsingKey.kid
    ) {
      return fail('invalid_input')
    }
    const assertion = keyEndorsementAssertion(claims.iss, claims.use, options.profile ?? 'release')
    if (!assertion.ok) {
      return assertion
    }
    return ok(
      signV4Public(
        endorsingKey.secretKey,
        new TextEncoder().encode(message),
        encodeKidFooter(endorsingKey.kid),
        assertion.value
      )
    )
  } catch {
    return fail('internal_error')
  }
}
