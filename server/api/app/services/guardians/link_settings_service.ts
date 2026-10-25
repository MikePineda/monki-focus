// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'
import type GuardianLink from '#models/guardian_link'
import Guardianship from '#services/guardians/guardianship'
import GuardianLinkRegistry from '#services/guardians/guardian_link_registry'

export interface LinkSettingsChanges {
  readonly maxUnlockMinutes?: number
  readonly allowNotificationActions?: boolean
}

/**
 * `PATCH /guardian/links/:id`: the guardian's own settings of a live link
 * (the validator bounds `maxUnlockMinutes` by the instance cap). Reached
 * only through the guardian (the ward gets a 404) and only with two-step
 * verification on.
 */
@inject()
export default class LinkSettingsService {
  constructor(
    protected links: GuardianLinkRegistry,
    protected guardianship: Guardianship
  ) {}

  async update(
    guardian: User,
    linkId: number,
    changes: LinkSettingsChanges,
    now: DateTime
  ): Promise<GuardianLink> {
    await this.links.findLive(guardian, linkId, 'guardian', now)
    this.guardianship.requireTwoFactor(guardian)

    return db.transaction(async (trx) => {
      const link = await this.links.findLive(guardian, linkId, 'guardian', now, {
        trx,
        forUpdate: true,
      })
      if (changes.maxUnlockMinutes !== undefined) link.maxUnlockMinutes = changes.maxUnlockMinutes
      if (changes.allowNotificationActions !== undefined) {
        link.allowNotificationActions = changes.allowNotificationActions
      }
      await link.useTransaction(trx).save()
      return link
    })
  }
}
