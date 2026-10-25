// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'
import type User from '#models/user'
import { userResource } from '#transformers/user_transformer'
import InvitationService from '#services/accounts/invitation_service'
import TwoFactorService from '#services/accounts/two_factor_service'
import { invitationResource } from '#transformers/invitation_transformer'

/** Identifies the document; bump `version` on any breaking change of its shape. */
export const EXPORT_FORMAT = 'monki-focus.export'
export const EXPORT_VERSION = 1

/**
 * `GET /me/export?format=native`: everything the server holds about the
 * user, as JSON, read only through the user's own scope. Secrets are never
 * part of it (password hash, TOTP seed, recovery code and invitation
 * digests). Later packages add their sections (devices, unlocks, activity;
 * the ActivityWatch format comes with analytics).
 */
@inject()
export default class AccountExport {
  constructor(
    protected invitations: InvitationService,
    protected twoFactor: TwoFactorService
  ) {}

  async build(user: User, now: DateTime) {
    const invitations = await this.invitations.list(user)

    return {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: now.toUTC().toISO(),
      user: { ...userResource(user), updatedAt: user.updatedAt.toUTC().toISO() },
      twoFactor: {
        enabled: user.twoFactorEnabled,
        enabledAt: user.totpEnabledAt?.toUTC().toISO() ?? null,
        recoveryCodesRemaining: user.twoFactorEnabled
          ? await this.twoFactor.remainingRecoveryCodes(user)
          : 0,
      },
      invitationsCreated: invitations.map((invitation) => invitationResource(invitation, now)),
    }
  }
}
