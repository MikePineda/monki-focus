// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The life of a guardian link:
 *
 * - `pending`: a guardian redeemed the ward's pairing code; nothing is
 *   granted (the guardian does not even learn who the ward is) until the
 *   ward confirms them and they have two-step verification on
 *   (link_activation.ts). Unconfirmed, it lapses after
 *   PENDING_LINK_TTL_HOURS.
 * - `active`: the guardian approves unlocks and sees the ward's summary.
 * - `revoking`: the ward asked to leave. Two phases: the guardian stops
 *   seeing the ward at once, but still decides unlock requests until
 *   `revocationEffectiveAt`, so the ward's commitment holds through the
 *   cooldown (link_revocation.ts).
 * - `revoked`: over. Nothing is reachable through it again.
 *
 * Only `pending`, `active` and `revoked` are stored; `revoking` is an
 * active row with a deadline, and a deadline in the past (or a pending
 * link past its lifetime) already reads as `revoked` here, so access ends
 * on time even if the job storing the end runs late.
 */
export type StoredLinkStatus = 'pending' | 'active' | 'revoked'
export type LinkState = 'pending' | 'active' | 'revoking' | 'revoked'
export type LinkRole = 'ward' | 'guardian'

export const STORED_LINK_STATUSES: readonly StoredLinkStatus[] = ['pending', 'active', 'revoked']

/** A link the ward has not confirmed after this long is declined by itself. */
export const PENDING_LINK_TTL_HOURS = 24

const HOUR_MS = 3_600_000

export interface LinkTimeline {
  readonly status: StoredLinkStatus
  readonly revocationEffectiveAt: Date | null
  readonly createdAt: Date
}

/** When a pending link lapses. */
export function pendingLinkLapsesAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + PENDING_LINK_TTL_HOURS * HOUR_MS)
}

export function linkState(link: LinkTimeline, now: Date): LinkState {
  if (link.status === 'pending') {
    return pendingLinkLapsesAt(link.createdAt).getTime() <= now.getTime() ? 'revoked' : 'pending'
  }
  if (link.status !== 'active') return link.status
  if (link.revocationEffectiveAt === null) return 'active'
  return link.revocationEffectiveAt.getTime() <= now.getTime() ? 'revoked' : 'revoking'
}

/** Whether the guardian decides the ward's unlock requests (and so must keep a second factor). */
export function grantsGuardianship(state: LinkState): boolean {
  return state === 'active' || state === 'revoking'
}

/** Whether the guardian sees the ward's summary: only while nobody asked to leave. */
export function grantsVisibility(state: LinkState): boolean {
  return state === 'active'
}
