// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import { appUrl } from '#config/app'
import type User from '#models/user'
import Invitation from '#models/invitation'
import { oneWayDigest } from '#domain/accounts/one_way_digest'
import { findOwnedOrFail, ownedBy } from '#services/tenancy/owned_by'
import { consumeInvitationCreation } from '#services/accounts/account_throttles'
import { invitationExpiresAt } from '#domain/accounts/invitation_window'

/** Random bytes behind each link: 256 bits, 43 base64url characters. */
const LINK_BYTES = 32

/**
 * Admin invitations. The link is `<APP_URL>/invite#<random>`: the random
 * part sits in the fragment, which browsers never send to a server, so it
 * stays out of access logs and Referer headers. Only its SHA-256 is stored;
 * the link is returned once, at creation. Each admin sees and revokes only
 * the invitations they created.
 */
export default class InvitationService {
  async create(admin: User, email: string | null, now: DateTime) {
    await consumeInvitationCreation(admin.id)

    const linkPart = randomBytes(LINK_BYTES).toString('base64url')
    const invitation = await Invitation.create({
      createdByUserId: admin.id,
      tokenHash: oneWayDigest(linkPart),
      email,
      expiresAt: DateTime.fromJSDate(invitationExpiresAt(now.toJSDate()), { zone: 'utc' }),
      usedAt: null,
      usedByUserId: null,
    })

    return { invitation, url: `${appUrl.replace(/\/+$/, '')}/invite#${linkPart}` }
  }

  list(admin: User) {
    return ownedBy(Invitation, admin, 'created_by_user_id').orderBy('created_at', 'desc')
  }

  /** Deletes one of the admin's own invitations; anyone else's id is a 404. */
  async revoke(admin: User, id: number) {
    const invitation = await findOwnedOrFail(Invitation, admin, id, {
      column: 'created_by_user_id',
    })
    await invitation.delete()
  }
}
