// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto'

/**
 * The Chromium extension id a `manifest.key` pins: the first 128 bits of the
 * SHA-256 of the DER public key, one letter `a`-`p` per nibble. The macOS
 * bridge's host manifest lists exactly this id in `allowed_origins`, so the
 * development build (`EXTENSION_DEV_PUBLIC_KEY`) and the store build (id
 * assigned by the Chrome Web Store) each need their id there.
 */
export function extensionIdOf(base64PublicKey: string): string {
  const der = Buffer.from(base64PublicKey.trim(), 'base64')
  if (der.length === 0) throw new RangeError('extensionIdOf needs a base64 DER public key')
  const hex = createHash('sha256').update(der).digest('hex').slice(0, 32)
  return [...hex].map((digit) => String.fromCharCode(97 + Number.parseInt(digit, 16))).join('')
}

// `npm run extension-id -w @monki-focus/extension`: prints the id
// `EXTENSION_DEV_PUBLIC_KEY` pins (for `bridge.extensionIds` on the Mac).
if (import.meta.main) {
  const key = process.env.EXTENSION_DEV_PUBLIC_KEY
  if (key === undefined || key.trim() === '') {
    console.error('EXTENSION_DEV_PUBLIC_KEY is not set')
    process.exit(1)
  }
  console.log(extensionIdOf(key))
}
