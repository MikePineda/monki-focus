// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import {
  unlockDecidedDedupeKey,
  unlockRequestDedupeKey,
  type NotificationPayload,
} from '#domain/notify/notification_payload'
import { NOTIFICATION_OUTBOX_TABLE } from '#services/guardians/guardian_notices'
import { sealActionTokens, type ActionTokens } from '#services/notify/action_seal'

export interface NotifiedLink {
  readonly id: number
  readonly guardianUserId: number
  readonly ntfyTopic: string
}

/**
 * Queues the unlock flow's notifications for a link's guardian in the
 * caller's transaction (so they exist exactly when the change commits).
 * Answers the outbox row id, or null when the dedupe key already queued it.
 */
export default class UnlockNotifications {
  async queueRequest(
    trx: TransactionClientContract,
    link: NotifiedLink,
    request: { uuid: string; minutes: number },
    tokens: ActionTokens,
    now: DateTime
  ): Promise<number | null> {
    return this.insert(trx, link, now, unlockRequestDedupeKey(request.uuid), {
      type: 'unlock_request',
      linkId: link.id,
      requestUuid: request.uuid,
      minutes: request.minutes,
      sealedActions: sealActionTokens(tokens),
    })
  }

  async queueDecision(
    trx: TransactionClientContract,
    link: NotifiedLink,
    request: { uuid: string; decision: 'approved' | 'denied'; minutes: number },
    now: DateTime
  ): Promise<number | null> {
    return this.insert(trx, link, now, unlockDecidedDedupeKey(request.uuid), {
      type: 'unlock_decided',
      linkId: link.id,
      requestUuid: request.uuid,
      decision: request.decision,
      minutes: request.minutes,
    })
  }

  protected async insert(
    trx: TransactionClientContract,
    link: NotifiedLink,
    now: DateTime,
    dedupeKey: string,
    payload: NotificationPayload
  ): Promise<number | null> {
    const at = now.toJSDate()
    const rows = (await trx
      .table(NOTIFICATION_OUTBOX_TABLE)
      .insert({
        recipient_user_id: link.guardianUserId,
        channel: 'ntfy',
        topic: link.ntfyTopic,
        payload: JSON.stringify(payload),
        dedupe_key: dedupeKey,
        attempts: 0,
        next_attempt_at: at,
        created_at: at,
      })
      .onConflict('dedupe_key')
      .ignore()
      .returning('id')) as Array<{ id: number }>
    return rows[0]?.id ?? null
  }
}
