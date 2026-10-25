// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'
import type User from '#models/user'
import type GuardianLink from '#models/guardian_link'
import { CodedError } from '#exceptions/coded_error'
import { grantsGuardianship } from '#domain/guardians/link_state'
import { ntfySubscription, type NtfySubscription } from '#domain/guardians/ntfy_subscription'
import Guardianship from '#services/guardians/guardianship'
import GuardianLinkRegistry from '#services/guardians/guardian_link_registry'
import { ntfyPublicBaseUrl } from '#services/guardians/ntfy_topics'
import { notActive } from '#services/guardians/topic_rotation'

/**
 * `GET /guardian/links/:id/subscribe`: how the guardian's phone subscribes
 * to an active link's topic (URL, `ntfy://` deep link, QR payload). Only
 * the guardian reaches it (the ward never learns the topic: 404), with
 * two-step verification on. The topic is a capability: the response is
 * never cached and never logged.
 */
@inject()
export default class LinkSubscription {
  constructor(
    protected links: GuardianLinkRegistry,
    protected guardianship: Guardianship
  ) {}

  async subscribe(guardian: User, linkId: number, now: DateTime): Promise<NtfySubscription> {
    const link = await this.links.findLive(guardian, linkId, 'guardian', now)
    this.guardianship.requireTwoFactor(guardian)
    if (!grantsGuardianship(link.stateAt(now))) throw notActive()
    return this.of(link)
  }

  /** The subscription of a link already checked by the caller (topic rotation). */
  of(link: GuardianLink): NtfySubscription {
    const base = ntfyPublicBaseUrl()
    if (!base) {
      throw new CodedError('E_NOTIFICATIONS_UNAVAILABLE', 409, 'ntfy is not configured')
    }
    return ntfySubscription(base, link.ntfyTopic)
  }
}
