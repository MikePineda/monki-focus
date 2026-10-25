// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import type Invitation from '#models/invitation'
import { invitationStatus } from '#domain/accounts/invitation_window'

/** An invitation as its admin sees it: never the link nor its digest. */
export function invitationResource(invitation: Invitation, now: DateTime) {
  return {
    id: invitation.id,
    email: invitation.email,
    status: invitationStatus(
      { expiresAt: invitation.expiresAt.toJSDate(), usedAt: invitation.usedAt?.toJSDate() ?? null },
      now.toJSDate()
    ),
    expiresAt: invitation.expiresAt.toUTC().toISO(),
    usedAt: invitation.usedAt?.toUTC().toISO() ?? null,
    createdAt: invitation.createdAt.toUTC().toISO(),
  }
}
