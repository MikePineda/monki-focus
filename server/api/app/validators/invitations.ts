// SPDX-License-Identifier: AGPL-3.0-or-later
import vine from '@vinejs/vine'
import { email } from '#validators/account_fields'

/** POST /admin/invitations. With an email, only that address may accept it. */
export const createInvitationValidator = vine.create({
  email: email().nullable().optional(),
})

/** POST /me/invitation: the secret part of an invitation link. */
export const acceptInvitationValidator = vine.create({
  invitation: vine.string().trim().minLength(1).maxLength(128),
})
