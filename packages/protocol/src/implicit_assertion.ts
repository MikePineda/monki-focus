// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The implicit assertion binds a token to one instance and one device (and,
 * for time tokens, to one request) without carrying that binding in the
 * token:
 *
 *   unlock: "monki-focus/unlock/v1|" + iss + "|" + dev
 *   policy: "monki-focus/policy/v1|" + iss + "|" + dev
 *   time:   "monki-focus/time/v1|" + iss + "|" + dev + "|" + nonce + "|" + boot
 *
 * The verifier builds it from its own pinned issuer, its own device id and
 * (for time tokens) the nonce and boot id it just sent, so a token issued for
 * another device, another server or another request fails the signature
 * check. No value may contain "|" (the formats forbid it), which keeps the
 * concatenation unambiguous.
 */
import {
  BOOT_ID_PATTERN,
  DEVICE_ID_PATTERN,
  ISSUER_PATTERN,
  NONCE_PATTERN,
  RELEASE_ISSUER_PATTERN,
} from './claim_formats.ts'
import { fail, ok, type Result } from './token_error.ts'
import { TOKEN_PURPOSES, type TokenPurpose } from './token_purpose.ts'

/**
 * `release` accepts only `https://host` issuers; `development` also accepts
 * `http://localhost` and `http://127.0.0.1` with a port. Clients ship with
 * `release`.
 */
export type IssuerProfile = 'release' | 'development'

export interface AssertionBinding {
  readonly issuer: string
  readonly device: string
  /** Time tokens only. */
  readonly nonce?: string
  /** Time tokens only. */
  readonly boot?: string
}

export function implicitAssertionText(purpose: TokenPurpose, binding: AssertionBinding): string {
  const parts = [TOKEN_PURPOSES[purpose].assertionPrefix, binding.issuer, binding.device]
  if (purpose === 'time') {
    parts.push(binding.nonce ?? '', binding.boot ?? '')
  }
  return parts.join('|')
}

export function implicitAssertion(
  purpose: TokenPurpose,
  binding: AssertionBinding,
  profile: IssuerProfile = 'release'
): Result<Uint8Array> {
  const issuerPattern = profile === 'development' ? ISSUER_PATTERN : RELEASE_ISSUER_PATTERN
  if (!issuerPattern.test(binding.issuer) || !DEVICE_ID_PATTERN.test(binding.device)) {
    return fail('invalid_input')
  }
  if (purpose === 'time') {
    if (!NONCE_PATTERN.test(binding.nonce ?? '') || !BOOT_ID_PATTERN.test(binding.boot ?? '')) {
      return fail('invalid_input')
    }
  } else if (binding.nonce !== undefined || binding.boot !== undefined) {
    return fail('invalid_input')
  }
  return ok(new TextEncoder().encode(implicitAssertionText(purpose, binding)))
}
