// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  BOOT_ID_PATTERN,
  formatRfc3339Utc,
  issueTimeToken,
  MAX_REVOKED_PER_TIME_TOKEN,
  NONCE_PATTERN,
  type TimeClaims,
  type TokenErrorCode,
} from '@monki-focus/protocol'
import { refuse, succeed, type Outcome } from '#domain/outcome'
import { isEpochSeconds, type TokenSigningContext } from '#domain/unlock/token_signing_context'
import { isStillUsable, type UnlockRevocation } from '#domain/unlock/unlock_token_ledger'

/** What the device sent with its heartbeat or unlock poll. */
export interface TimeRequest {
  readonly deviceUuid: string
  /** 16 random bytes, unpadded base64url, fresh per request. */
  readonly nonce: string
  readonly boot: string
}

export interface IssuedTimeToken {
  readonly token: string
  readonly claims: TimeClaims
}

export type TimeIssueFailure = 'wrong_key_purpose' | 'invalid_binding' | TokenErrorCode

/**
 * Answers a device's request with a time token (spec §4.3): the server's
 * time and the revoked, still usable unlock tokens of the device, bound by
 * the implicit assertion to the nonce and boot id the device sent, signed
 * with the unlock key.
 *
 * At most 32 revocations fit; when there are more, the ones that stay
 * usable longest are listed and `complete` is false, so the device
 * revalidates everything (spec §9). The list is never truncated silently.
 */
export function issueTime(
  request: TimeRequest,
  revocations: readonly UnlockRevocation[],
  context: TokenSigningContext
): Outcome<IssuedTimeToken, TimeIssueFailure> {
  const { now, signingKey } = context
  if (!isEpochSeconds(now)) return refuse('invalid_input')
  if (signingKey.purpose !== 'unlock') return refuse('wrong_key_purpose')
  if (!NONCE_PATTERN.test(request.nonce) || !BOOT_ID_PATTERN.test(request.boot)) {
    return refuse('invalid_binding')
  }

  const { listed, complete } = selectRevocations(revocations, now)
  const claims: TimeClaims = {
    v: 1,
    typ: 'time',
    iss: context.issuer,
    dev: request.deviceUuid,
    nonce: request.nonce,
    boot: request.boot,
    srv: formatRfc3339Utc(now),
    revoked: listed.map((revocation) => ({
      jti: revocation.jti,
      exp: formatRfc3339Utc(revocation.expiresAt),
    })),
    complete,
  }
  const signed = issueTimeToken(claims, signingKey, { profile: context.profile })
  if (!signed.ok) return refuse(signed.error.code)
  return succeed({ token: signed.value, claims })
}

/**
 * The revocations to list at `now`: still usable, one per jti, those that
 * stay usable longest first (then by jti, so the token is deterministic),
 * at most 32. `complete` says whether every one of them fit.
 */
export function selectRevocations(
  revocations: readonly UnlockRevocation[],
  now: number
): { listed: UnlockRevocation[]; complete: boolean } {
  const byJti = new Map<string, UnlockRevocation>()
  for (const revocation of revocations) {
    if (!isStillUsable(revocation, now)) continue
    const known = byJti.get(revocation.jti)
    if (known === undefined || known.expiresAt < revocation.expiresAt) {
      byJti.set(revocation.jti, revocation)
    }
  }
  const usable = [...byJti.values()].sort(
    (a, b) => b.expiresAt - a.expiresAt || a.jti.localeCompare(b.jti)
  )
  return {
    listed: usable.slice(0, MAX_REVOKED_PER_TIME_TOKEN),
    complete: usable.length <= MAX_REVOKED_PER_TIME_TOKEN,
  }
}
