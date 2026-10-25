// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto'
import { CLOCK_SKEW_SECONDS } from '@monki-focus/protocol'
import { refuse, succeed, type Outcome } from '#domain/outcome'

/**
 * One issued unlock token as the server remembers it (`unlock_tokens`):
 * enough to list and revoke it, never the token itself (only its SHA-256).
 * Times are epoch seconds.
 */
export interface UnlockLedgerEntry {
  readonly jti: string
  readonly requestUuid: string
  readonly deviceUuid: string
  readonly kid: string
  /** Lowercase hex SHA-256 of the token string. */
  readonly tokenHash: string
  readonly issuedAt: number
  readonly notBefore: number
  readonly expiresAt: number
  readonly revokedAt: number | null
}

/** A revocation as a time token carries it, before formatting. */
export interface UnlockRevocation {
  readonly jti: string
  readonly expiresAt: number
}

export type RevocationFailure = 'already_revoked' | 'already_expired'

/** The stored fingerprint of a token: lowercase hex SHA-256 (64 characters). */
export function unlockTokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/**
 * Whether a device can still act on the token at `now`: verifiers accept
 * it until `exp + 60 s` (spec §4.6), so a revocation matters until then.
 */
export function isStillUsable(entry: Pick<UnlockLedgerEntry, 'expiresAt'>, now: number): boolean {
  return now <= entry.expiresAt + CLOCK_SKEW_SECONDS
}

/**
 * Revokes an issued token at `now`. Refused (with a code, so the caller can
 * answer idempotently) when it was already revoked, or when it can no longer
 * be used anyway: a time token lists only revoked tokens that are still
 * usable.
 */
export function revokeUnlockToken(
  entry: UnlockLedgerEntry,
  now: number
): Outcome<UnlockLedgerEntry, RevocationFailure> {
  if (entry.revokedAt !== null) return refuse('already_revoked')
  if (!isStillUsable(entry, now)) return refuse('already_expired')
  return succeed({ ...entry, revokedAt: now })
}

/** The revocations a time token must carry at `now`: revoked and still usable. */
export function pendingRevocations(
  entries: readonly UnlockLedgerEntry[],
  now: number
): UnlockRevocation[] {
  return entries
    .filter((entry) => entry.revokedAt !== null && isStillUsable(entry, now))
    .map((entry) => ({ jti: entry.jti, expiresAt: entry.expiresAt }))
}
