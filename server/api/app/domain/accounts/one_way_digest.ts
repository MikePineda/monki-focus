// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * What the database stores for a high-entropy one-time value (invitation
 * links, recovery codes): its SHA-256 in hex (64 chars). Lookups go by
 * digest, so the clear value never reaches a query or a log. Enough on its
 * own because the inputs carry at least 80 random bits; low-entropy codes
 * (pairing, enrolment) use an HMAC with a pepper instead.
 */
export function oneWayDigest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

/** Constant-time comparison of two hex digests. */
export function digestsMatch(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex')
  const b = Buffer.from(right, 'hex')
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b)
}
