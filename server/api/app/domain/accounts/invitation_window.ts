// SPDX-License-Identifier: AGPL-3.0-or-later

/** Days an invitation link stays valid. */
export const INVITATION_TTL_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

export type InvitationStatus = 'pending' | 'used' | 'expired'

/** When an invitation created at `createdAt` stops working. */
export function invitationExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + INVITATION_TTL_DAYS * DAY_MS)
}

/** An invitation's state at `now`: used wins over expired, and expiry is exclusive. */
export function invitationStatus(
  invitation: { expiresAt: Date; usedAt: Date | null },
  now: Date
): InvitationStatus {
  if (invitation.usedAt) return 'used'
  return now.getTime() < invitation.expiresAt.getTime() ? 'pending' : 'expired'
}
