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
 * so the ward confirms exactly whom they are letting in.
 * `guardianTwoFactorEnabled` tells both why a pending link cannot be
 * confirmed yet.
 */
export function guardianLinkResource(
  link: GuardianLink,
  role: LinkRole,
  parties: LinkParties,
  now: DateTime
) {
  const counterpart = role === 'ward' ? parties.guardian : parties.ward
  return {
    id: link.id,
    role,
    status: link.stateAt(now),
    wardUserId: link.wardUserId,
    counterpart: { email: counterpart.email, fullName: counterpart.fullName },
    guardianTwoFactorEnabled: parties.guardian.twoFactorEnabled,
    maxUnlockMinutes: link.maxUnlockMinutes,
    allowNotificationActions: link.allowNotificationActions,
    confirmedAt: link.confirmedAt?.toUTC().toISO() ?? null,
    revocationRequestedAt: link.revocationRequestedAt?.toUTC().toISO() ?? null,
    revocationEffectiveAt: link.revocationEffectiveAt?.toUTC().toISO() ?? null,
    createdAt: link.createdAt.toUTC().toISO(),
  }
}
