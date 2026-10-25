// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LinkState } from '#domain/guardians/link_state'

/**
 * When a pending link may become active: the ward confirms the guardian
 * (by their account, on the ward's own session, password again), and only
 * if the guardian already has two-step verification on. Without it a
 * stolen guardian password would be enough to approve unlocks.
 */
export type ActivationRefusal = 'not_pending' | 'guardian_two_factor_required'

export function activationRefusal(link: {
  readonly state: LinkState
  readonly guardianTwoFactorEnabled: boolean
}): ActivationRefusal | null {
  if (link.state !== 'pending') return 'not_pending'
  if (!link.guardianTwoFactorEnabled) return 'guardian_two_factor_required'
  return null
}
