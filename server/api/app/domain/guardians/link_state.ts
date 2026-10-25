// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The life of a guardian link:
 *
 * - `pending`: a guardian redeemed the ward's pairing code; nothing is
 *   granted until the ward confirms them and they have two-step
 *   verification on (link_activation.ts).
 * - `active`: the guardian approves unlocks and sees the ward's summary.
 * - `revoking`: still active, but the ward asked to leave; it ends by
 *   itself at `revocationEffectiveAt` (link_revocation.ts).
 * - `revoked`: over. Nothing is reachable through it again.
 *
 * Only `pending`, `active` and `revoked` are stored; `revoking` is an
 * active row with a deadline, and a deadline in the past already reads as
 * `revoked` here, so access ends on time even if the job finishing it
 * runs late.
 */
export type StoredLinkStatus = 'pending' | 'active' | 'revoked'
export type LinkState = 'pending' | 'active' | 'revoking' | 'revoked'
export type LinkRole = 'ward' | 'guardian'

export const STORED_LINK_STATUSES: readonly StoredLinkStatus[] = ['pending', 'active', 'revoked']

export function linkState(
  link: { readonly status: StoredLinkStatus; readonly revocationEffectiveAt: Date | null },
  now: Date
): LinkState {
  if (link.status !== 'active') return link.status
  if (link.revocationEffectiveAt === null) return 'active'
  return link.revocationEffectiveAt.getTime() <= now.getTime() ? 'revoked' : 'revoking'
}

/** Whether the guardian reaches the ward's summary and decides unlocks. */
export function grantsGuardianship(state: LinkState): boolean {
  return state === 'active' || state === 'revoking'
}
