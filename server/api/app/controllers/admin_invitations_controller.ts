// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import Clock from '#services/clock'
import { createInvitationValidator } from '#validators/invitations'
import InvitationService from '#services/accounts/invitation_service'
import { invitationResource } from '#transformers/invitation_transformer'

/** Admin-only (`admin` middleware): each admin manages the invitations they created. */
@inject()
export default class AdminInvitationsController {
  constructor(
    protected invitations: InvitationService,
    protected clock: Clock
  ) {}

  /** GET /admin/invitations: newest first, with their status; never the links. */
  async index({ auth }: HttpContext) {
    const now = this.clock.now()
    const invitations = await this.invitations.list(auth.getUserOrFail())
    return { invitations: invitations.map((invitation) => invitationResource(invitation, now)) }
  }

  /** POST /admin/invitations: 201 with the link, shown this once. */
  async store({ auth, request, response }: HttpContext) {
    const { email } = await request.validateUsing(createInvitationValidator)
    const now = this.clock.now()
    const { invitation, url } = await this.invitations.create(
      auth.getUserOrFail(),
      email ?? null,
      now
    )
    response.header('Cache-Control', 'no-store')
    return response.created({ invitation: invitationResource(invitation, now), url })
  }

  /** DELETE /admin/invitations/:id: revokes one of the admin's own (anyone else's is 404). */
  async destroy({ auth, params, response }: HttpContext) {
    await this.invitations.revoke(auth.getUserOrFail(), Number(params.id))
    return response.noContent()
  }
}
