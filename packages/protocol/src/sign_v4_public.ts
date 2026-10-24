// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * PASETO v4.public signing (spec: "v4.Sign"):
 *
 *   m2 = PAE("v4.public.", message, footer, implicitAssertion)
 *   sig = Ed25519-Sign(secretKey, m2)
 *   token = "v4.public." || base64url(message || sig) [ || "." || base64url(footer) ]
 *
 * Ed25519 (RFC 8032) is deterministic, so the same key and inputs always
 * produce the same token; the shared vectors rely on that.
 */
import { sign as ed25519Sign, type KeyObject } from 'node:crypto'
import { encodeBase64Url } from './base64url.ts'
import { isEd25519PrivateKey } from './ed25519_key.ts'
import { pae } from './pae.ts'
import { V4_PUBLIC_HEADER } from './token_parts.ts'

const HEADER_BYTES = new TextEncoder().encode(V4_PUBLIC_HEADER)

export function signV4Public(
  secretKey: KeyObject,
  message: Uint8Array,
  footer: Uint8Array = new Uint8Array(0),
  implicitAssertion: Uint8Array = new Uint8Array(0)
): string {
  if (!isEd25519PrivateKey(secretKey)) {
    throw new TypeError('signV4Public needs an Ed25519 private key')
  }
  const signature = ed25519Sign(
    null,
    pae([HEADER_BYTES, message, footer, implicitAssertion]),
    secretKey
  )
  const body = encodeBase64Url(Buffer.concat([message, signature]))
  const token = `${V4_PUBLIC_HEADER}${body}`
  return footer.byteLength === 0 ? token : `${token}.${encodeBase64Url(footer)}`
}
