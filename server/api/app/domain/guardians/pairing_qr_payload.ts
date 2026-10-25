// SPDX-License-Identifier: AGPL-3.0-or-later
import { isPairingCode } from '#domain/guardians/pairing_code'

/**
 * What the ward's pairing QR code holds: the instance's dashboard URL and
 * the code, nothing else (no name, no email, no id). The code travels in
 * the fragment (`<APP_URL>/pair#<code>`), which browsers never send to a
 * server, so it reaches no access log; the dashboard reads it and posts it.
 */
export function pairingQrPayload(appUrl: string, code: string): string {
  if (!isPairingCode(code)) throw new RangeError('Not a pairing code')
  const base = new URL(appUrl)
  const path = base.pathname.replace(/\/+$/, '')
  return `${base.origin}${path}/pair#${code}`
}
