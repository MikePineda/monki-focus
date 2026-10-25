// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LinkRole, LinkState } from '#domain/guardians/link_state'

/**
 * Ending a guardian link. Leaving is always possible, never instant for
 * the ward of an active link:
 *
 * - the guardian may end it at once (they lose access, the ward loses
 *   nothing);
 * - the ward of an active link asks, and it ends by itself after
 *   `WARD_REVOCATION_COOLDOWN_HOURS` (default 24); the guardian gets a
 *   neutral notice meanwhile, and the ward may change their mind;
 * - a link that never became active (pending) ends at once, whoever asks;
 * - asking again keeps the first deadline.
 *
 * Revocation only changes the link: the ward's own data stays.
 */

/** `WARD_REVOCATION_COOLDOWN_HOURS` when it is empty. */
export const DEFAULT_WARD_REVOCATION_COOLDOWN_HOURS = 24

export type RevocationPlan =
  | { readonly kind: 'immediate' }
  | { readonly kind: 'scheduled'; readonly effectiveAt: Date }
  | { readonly kind: 'already_scheduled' }
  | { readonly kind: 'already_revoked' }

export function wardRevocationCooldownHours(configured: number | undefined): number {
  return configured ?? DEFAULT_WARD_REVOCATION_COOLDOWN_HOURS
}

export function planRevocation(request: {
  readonly by: LinkRole
  readonly state: LinkState
  readonly now: Date
  readonly cooldownHours: number
}): RevocationPlan {
  if (request.state === 'revoked') return { kind: 'already_revoked' }
  if (request.by === 'guardian' || request.state === 'pending') return { kind: 'immediate' }
  if (request.state === 'revoking') return { kind: 'already_scheduled' }
  if (request.cooldownHours <= 0) return { kind: 'immediate' }
  return {
    kind: 'scheduled',
    effectiveAt: new Date(request.now.getTime() + request.cooldownHours * 3_600_000),
  }
}

/** Only the ward withdraws their own request to leave, and only while it is pending. */
export function canCancelRevocation(by: LinkRole, state: LinkState): boolean {
  return by === 'ward' && state === 'revoking'
}
