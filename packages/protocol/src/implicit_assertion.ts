// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The implicit assertion binds a token to one instance and one device
 * without carrying that binding in the token:
 *
 *   unlock: "monki-focus/unlock/v1|" + iss + "|" + dev
 *   policy: "monki-focus/policy/v1|" + iss + "|" + dev
 *
 * The verifier builds it from its own pinned issuer and its own device id, so
 * a token issued for another device or another server fails the signature
 * check. Neither value may contain "|" (the claim formats forbid it), which
 * keeps the concatenation unambiguous.
 */
import { DEVICE_ID_PATTERN, ISSUER_PATTERN } from './claim_formats.ts'
import { fail, ok, type Result } from './token_error.ts'
import { TOKEN_PURPOSES, type TokenPurpose } from './token_purpose.ts'

export function implicitAssertionText(
  purpose: TokenPurpose,
  issuer: string,
  device: string
): string {
  return `${TOKEN_PURPOSES[purpose].assertionPrefix}|${issuer}|${device}`
}

export function implicitAssertion(
  purpose: TokenPurpose,
  issuer: string,
  device: string
): Result<Uint8Array> {
  if (!ISSUER_PATTERN.test(issuer) || !DEVICE_ID_PATTERN.test(device)) {
    return fail('invalid_input')
  }
  return ok(new TextEncoder().encode(implicitAssertionText(purpose, issuer, device)))
}
