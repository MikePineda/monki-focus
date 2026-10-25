// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import type User from '#models/user'
import type GuardianLink from '#models/guardian_link'
import type { LinkRole } from '#domain/guardians/link_state'

/** Both people of a link, loaded once by the caller. */
export interface LinkParties {
  readonly ward: User
  readonly guardian: User
}

/**
 * A guardian link as one of its two people sees it. An allowlist: never
 * the ntfy topic (the guardian gets it only from the subscribe and rotate
 * routes), never internal ids beyond the link's own and the ward's (the
 * summary route takes it). The other person is shown by email and name,
 * so the ward confirms exactly whom they are letting in; the guardian side
 * gets neither the ward's id nor their identity (`counterpart: null`) for a
 * link the ward never confirmed, pending or declined.
 * `guardianTwoFactorEnabled` tells both why a pending link cannot be
 * confirmed yet.
 */
export function guardianLinkResource(
  link: GuardianLink,
  role: LinkRole,
  parties: LinkParties,
  now: DateTime
) {
  const other = role === 'ward' ? parties.guardian : parties.ward
  // Until the ward confirms them, the person who redeemed the code learns
  // nothing about the ward: a guessed or leaked code reveals no one.
  const wardHidden = role === 'guardian' && link.confirmedAt === null
  return {
    id: link.id,
    role,
    status: link.stateAt(now),
    ...(wardHidden ? {} : { wardUserId: link.wardUserId }),
    counterpart: wardHidden ? null : { email: other.email, fullName: other.fullName },
    guardianTwoFactorEnabled: parties.guardian.twoFactorEnabled,
    maxUnlockMinutes: link.maxUnlockMinutes,
    allowNotificationActions: link.allowNotificationActions,
    confirmedAt: link.confirmedAt?.toUTC().toISO() ?? null,
    revocationRequestedAt: link.revocationRequestedAt?.toUTC().toISO() ?? null,
    revocationEffectiveAt: link.revocationEffectiveAt?.toUTC().toISO() ?? null,
    createdAt: link.createdAt.toUTC().toISO(),
  }
}
