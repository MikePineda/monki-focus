// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash, timingSafeEqual } from 'node:crypto'
import { encodeBase64Url } from '@monki-focus/protocol'

/**
 * The capability behind an ntfy action button
 * (docs/adr/0003-ntfy-capability-actions.md): 256 random bits per request
 * and decision (approve, deny), unpadded base64url, valid 15 minutes and
 * once. Only its SHA-256 is stored; any decision on the request clears
 * both hashes. Never logged.
 */
export const ACTION_TOKEN_BYTES = 32
export const ACTION_TOKEN_LIFETIME_SECONDS = 15 * 60
export const ACTION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const HASH_PATTERN = /^[0-9a-f]{64}$/

/** The token for 32 random bytes (the caller draws them). */
export function actionTokenFromBytes(bytes: Uint8Array): string {
  if (bytes.length !== ACTION_TOKEN_BYTES) {
    throw new RangeError(`An action token needs exactly ${ACTION_TOKEN_BYTES} random bytes`)
  }
  return encodeBase64Url(bytes)
}

export function isActionToken(value: unknown): value is string {
  return typeof value === 'string' && ACTION_TOKEN_PATTERN.test(value)
}

/** Lowercase hex SHA-256: what `unlock_requests` keeps. */
export function actionTokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Constant-time comparison of two stored-format hashes. */
export function actionHashesMatch(expected: string, candidate: string | null): boolean {
  if (candidate === null || !HASH_PATTERN.test(expected) || !HASH_PATTERN.test(candidate)) {
    return false
  }
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(candidate, 'hex'))
}

export function actionTokenExpiresAt(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + ACTION_TOKEN_LIFETIME_SECONDS * 1000)
}

export function isActionUsable(expiresAt: Date | null, now: Date): boolean {
  return expiresAt !== null && now.getTime() < expiresAt.getTime()
}
