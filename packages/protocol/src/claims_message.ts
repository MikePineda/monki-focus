// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Decodes an authenticated message as strict UTF-8 JSON (spec §5 step 8).
 * Only ever called after the signature has verified.
 */
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

export interface DecodedClaimsMessage {
  readonly text: string
  readonly value: object
}

/** The parsed JSON object, or `undefined` for invalid UTF-8, invalid JSON or a non-object. */
export function decodeClaimsMessage(message: Uint8Array): DecodedClaimsMessage | undefined {
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
