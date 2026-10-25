// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHmac } from 'node:crypto'

/**
 * The one-time code a ward shows (or puts in a QR code) so a trusted person
 * can become their guardian.
 *
 * - 6 ASCII digits, zero-padded, drawn uniformly; valid
 *   `PAIRING_CODE_TTL_MINUTES` (default 10); single use; one pending code
 *   per ward.
 * - The first 3 digits are the **lookup** part: unique among the pending
 *   codes, they find the one code a guess is about. The whole code proves
 *   it. So each wrong guess lands on at most one pending code, which counts
 *   it, and the fifth kills the code whatever address the guesses come
 *   from (the same reservation design as device enrolment).
 * - Stored only as HMAC-SHA256 digests keyed with the instance secret: a
 *   leaked row cannot be reversed offline, small as the code space is.
 * - A right code is not enough on its own: the ward still confirms the
 *   guardian (by account) before the link grants anything
 *   (app/domain/guardians/link_activation.ts).
 */

export const PAIRING_CODE_LENGTH = 6
export const PAIRING_CODE_PATTERN = /^[0-9]{6}$/
/** Codes there are: 000000 to 999999. */
export const PAIRING_CODE_SPACE = 1_000_000
export const PAIRING_LOOKUP_LENGTH = 3
/** The fifth wrong guess kills the code. */
export const PAIRING_CODE_MAX_ATTEMPTS = 5
/** `PAIRING_CODE_TTL_MINUTES` when it is empty. */
export const DEFAULT_PAIRING_CODE_TTL_MINUTES = 10

export type PairingCodeState = 'pending' | 'expired' | 'used' | 'locked'

export interface PairingCodeDigests {
  /** HMAC of the lookup part: finds the pending code. */
  readonly lookupHash: string
  /** HMAC of the whole code: proves it. */
  readonly codeHash: string
}

/** The code for a uniform integer in [0, 999999] (the caller draws it). */
export function pairingCodeFromInteger(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value >= PAIRING_CODE_SPACE) {
    throw new RangeError('A pairing code comes from an integer in [0, 999999]')
  }
  return String(value).padStart(PAIRING_CODE_LENGTH, '0')
}

export function isPairingCode(value: unknown): value is string {
  return typeof value === 'string' && PAIRING_CODE_PATTERN.test(value)
}

/** A typed code without the spaces or the dash people add (`123 456`, `123-456`), or null. */
export function normalizePairingCode(typed: string): string | null {
  const compact = typed.trim().replace(/[\s-]/g, '')
  return isPairingCode(compact) ? compact : null
}

export function pairingCodeTtlMinutes(configured: number | undefined): number {
  return configured ?? DEFAULT_PAIRING_CODE_TTL_MINUTES
}

/** Where a stored code stands at `now` (the database applies the same rule in its queries). */
export function pairingCodeState(
  code: { readonly expiresAt: Date; readonly usedAt: Date | null; readonly attempts: number },
  now: Date
): PairingCodeState {
  if (code.usedAt !== null) return 'used'
  if (code.attempts >= PAIRING_CODE_MAX_ATTEMPTS) return 'locked'
  if (code.expiresAt.getTime() <= now.getTime()) return 'expired'
  return 'pending'
}

/** Both digests of a well-formed code; labels keep them apart from every other HMAC of the secret. */
export function pairingCodeDigests(code: string, pepper: string): PairingCodeDigests {
  if (!isPairingCode(code)) throw new RangeError('Not a pairing code')
  const hmac = (label: string, value: string) =>
    createHmac('sha256', pepper).update(`monki-focus/${label}/v1|${value}`).digest('hex')
  return {
    lookupHash: hmac('pairing-lookup', code.slice(0, PAIRING_LOOKUP_LENGTH)),
    codeHash: hmac('pairing-code', code),
  }
}
