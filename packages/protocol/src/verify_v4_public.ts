// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * PASETO v4.public verification (spec: "v4.Verify"), on raw bytes only.
 *
 *   1. If a footer is expected, compare it with the token's footer in constant time.
 *   2. The header must be exactly `v4.public.`.
 *   3. Decode base64url(message || signature); the signature is the last 64 bytes.
 *   4. m2 = PAE(header, message, footer, implicitAssertion).
 *   5. Ed25519-verify the signature over m2 with the public key.
 *   6. Only then return the message.
 *
 * Steps 2 and 3 run first in code because the footer cannot be compared
 * before it is decoded; nothing is interpreted before step 5 either way.
 */
import { verify as ed25519Verify, type KeyObject } from 'node:crypto'
import { constantTimeEqual } from './constant_time_equal.ts'
import { publicKeyFromRaw } from './ed25519_key.ts'
import { pae } from './pae.ts'
import { fail, ok, type Result } from './token_error.ts'
import { parseTokenParts, type TokenParts } from './token_parts.ts'

export interface VerifiedV4Public {
  /** The authenticated message bytes. */
  readonly message: Uint8Array
  /** The authenticated footer bytes. */
  readonly footer: Uint8Array
}

export interface VerifyV4PublicOptions {
  /** Expected footer; when given, a different footer fails with `footer_mismatch`. */
  readonly footer?: Uint8Array
  /** Implicit assertion bound into the signature (empty when omitted). */
  readonly implicitAssertion?: Uint8Array
}

const EMPTY = new Uint8Array(0)

/** Verifies already-split parts against one public key. Never throws. */
export function verifyV4PublicParts(
  parts: TokenParts,
  publicKey: KeyObject,
  implicitAssertion: Uint8Array
): Result<VerifiedV4Public> {
  try {
    const signed = pae([parts.header, parts.message, parts.footer, implicitAssertion])
    if (!ed25519Verify(null, signed, publicKey, parts.signature)) {
      return fail('invalid_signature')
    }
    return ok({ message: parts.message, footer: parts.footer })
  } catch {
    return fail('invalid_signature')
  }
}

/** Verifies a token string against a raw 32-byte Ed25519 public key. Never throws. */
export function verifyV4Public(
  token: unknown,
  publicKey: Uint8Array,
  options: VerifyV4PublicOptions = {}
): Result<VerifiedV4Public> {
  try {
    const key = publicKeyFromRaw(publicKey)
    if (!key.ok) {
      return key
    }
    const parts = parseTokenParts(token)
    if (!parts.ok) {
      return parts
    }
    if (options.footer !== undefined && !constantTimeEqual(options.footer, parts.value.footer)) {
      return fail('footer_mismatch')
    }
    return verifyV4PublicParts(parts.value, key.value, options.implicitAssertion ?? EMPTY)
  } catch {
    return fail('internal_error')
  }
}
