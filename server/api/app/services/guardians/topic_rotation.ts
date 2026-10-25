// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'
import type GuardianLink from '#models/guardian_link'
import { CodedError } from '#exceptions/coded_error'
import { grantsGuardianship, type LinkRole } from '#domain/guardians/link_state'
import Guardianship from '#services/guardians/guardianship'
import GuardianNotices from '#services/guardians/guardian_notices'
import GuardianLinkEvents from '#services/guardians/guardian_link_events'
import GuardianLinkRegistry from '#services/guardians/guardian_link_registry'
import { consumeTopicRotation } from '#services/guardians/guardian_throttles'
import { drawNtfyTopic } from '#services/guardians/ntfy_topics'
import { retryOnDeadlock } from '#services/database/deadlock_retry'

/**
 * `POST /guardian/links/:id/rotate-topic`: either side replaces an active
 * link's ntfy topic (a leaked topic, a lost phone), 10 times per hour per
 * user. In the transaction that stores the new topic, every unsent outbox
 * row of the old one moves to it, so nothing new is ever published on the
 * old topic. The new topic is returned only to the guardian (who needs
 * two-step verification for it).
 *
 * When the ward rotates, the guardian's phone is still subscribed to the
 * old topic and would silently stop hearing anything: so one neutral
 * `topic_rotated` notice ("open the dashboard and subscribe again") is
 * queued on the old topic, the last message it ever gets, and
 * `guardian_topic_rotated` goes to the ward's log.
 */
@inject()
export default class TopicRotation {
  constructor(
    protected links: GuardianLinkRegistry,
    protected guardianship: Guardianship,
    protected notices: GuardianNotices,
    protected events: GuardianLinkEvents
  ) {}

  async rotate(
    user: User,
    linkId: number,
    now: DateTime
  ): Promise<{ link: GuardianLink; role: LinkRole }> {
    const { role } = await this.links.findLiveForParty(user, linkId, now)
    if (role === 'guardian') this.guardianship.requireTwoFactor(user)
    await consumeTopicRotation(user.id)

    return retryOnDeadlock(() => this.rotateOnce(user, role, linkId, now))
  }

  protected rotateOnce(
    user: User,
    role: LinkRole,
    linkId: number,
    now: DateTime
  ): Promise<{ link: GuardianLink; role: LinkRole }> {
    return db.transaction(async (trx) => {
      const { link } = await this.links.findLiveForParty(user, linkId, now, {
        trx,
        forUpdate: true,
      })
      if (!grantsGuardianship(link.stateAt(now))) throw notActive()

      const previous = link.ntfyTopic
      link.ntfyTopic = drawNtfyTopic()
      await link.useTransaction(trx).save()
      await this.notices.retarget(trx, previous, link.ntfyTopic)

      if (role === 'ward') {
        await this.notices.queue(
          trx,
          link,
          { kind: 'topic_rotated', linkId: link.id },
          now,
          previous
        )
        await this.events.record(trx, link, 'guardian_topic_rotated', {}, now, { onceAt: now })
      }
      return { link, role }
    })
  }
}

export function notActive() {
  return new CodedError('E_GUARDIAN_LINK_NOT_ACTIVE', 409, 'The link is not active')
}
