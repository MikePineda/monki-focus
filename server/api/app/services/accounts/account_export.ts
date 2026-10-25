// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'
import type User from '#models/user'
import { userResource } from '#transformers/user_transformer'
import InvitationService from '#services/accounts/invitation_service'
import TwoFactorService from '#services/accounts/two_factor_service'
import { invitationResource } from '#transformers/invitation_transformer'
import Device from '#models/device'
import BypassEvent from '#models/bypass_event'
import { ownedBy } from '#services/tenancy/owned_by'
import { deviceResource } from '#transformers/device_transformer'
import { bypassEventResource } from '#transformers/bypass_event_transformer'
import GuardianLinkRegistry from '#services/guardians/guardian_link_registry'

/** Identifies the document; bump `version` on any breaking change of its shape. */
export const EXPORT_FORMAT = 'monki-focus.export'
export const EXPORT_VERSION = 1

/**
 * `GET /me/export?format=native`: everything the server holds about the
 * user, as JSON, read only through the user's own scope. Secrets are never
 * part of it (password hash, TOTP seed, recovery code and invitation
 * digests, device tokens, enrolment and pairing codes, ntfy topics).
 * Devices, bypass events and guardian links (both sides, revoked ones
 * too) are here; later packages add theirs (unlocks, activity; the
 * ActivityWatch format comes with analytics).
 */
@inject()
export default class AccountExport {
  constructor(
    protected invitations: InvitationService,
    protected twoFactor: TwoFactorService,
    protected links: GuardianLinkRegistry
  ) {}

  async build(user: User, now: DateTime) {
    const invitations = await this.invitations.list(user)
    const devices = await ownedBy(Device, user).orderBy('id')
    const uuidOf = new Map(devices.map((device) => [device.id, device.uuid]))
    const bypassEvents = await ownedBy(BypassEvent, user, 'ward_user_id').orderBy('id')
    const history = await this.links.historyOf(user)
    const guardianLinks = await this.links.present(history, now)

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
      devices: devices.map(deviceResource),
      bypassEvents: bypassEvents.map((event) =>
        bypassEventResource(
          event,
          event.deviceId === null ? null : (uuidOf.get(event.deviceId) ?? null)
        )
      ),
      guardianLinks: guardianLinks.map((resource, index) => ({
        ...resource,
        revokedAt: history[index].link.revokedAt?.toUTC().toISO() ?? null,
      })),
    }
  }
}
