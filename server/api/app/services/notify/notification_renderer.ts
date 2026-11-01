// SPDX-License-Identifier: AGPL-3.0-or-later
import { DateTime } from 'luxon'
import env from '#start/env'
import i18nManager from '@adonisjs/i18n/services/main'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { ntfyMessage, type NtfyMessage } from '#domain/notify/ntfy_message'
import type { NotificationPayload } from '#domain/notify/notification_payload'
import { SUPPORTED_LOCALES, type SupportedLocale } from '#http/supported_locales'
import { unsealActionTokens } from '#services/notify/action_seal'

/** An outbox row as the dispatcher claimed it. */
export interface OutboxRow {
  readonly id: number
  readonly recipient_user_id: number
  readonly topic: string
  readonly payload: NotificationPayload
  readonly attempts: number
}

/**
 * Turns an outbox row into the ntfy message, in the recipient's locale and
 * time zone, reading inside the dispatcher's transaction:
 *
 * - the topic is re-read from the link at send time (a rotation since the
 *   row was queued wins), except for `topic_rotated`, the one notice meant
 *   for the old topic;
 * - an unlock request's buttons follow the link's current
 *   `allow_notification_actions`, and need the still-valid seal.
 */
export default class NotificationRenderer {
  async render(row: OutboxRow, client: QueryClientContract): Promise<NtfyMessage> {
    const recipient = await client
      .from('users')
      .select('locale', 'time_zone')
      .where('id', row.recipient_user_id)
      .first()
    const link = await client
      .from('guardian_links')
      .select('ntfy_topic', 'allow_notification_actions')
      .where('id', row.payload.linkId)
      .where('guardian_user_id', row.recipient_user_id)
      .first()

    const locale = SUPPORTED_LOCALES.includes(recipient?.locale)
      ? (recipient.locale as SupportedLocale)
      : (env.get('APP_DEFAULT_LOCALE') ?? 'en')
    const zone = recipient?.time_zone ?? 'UTC'
    const i18n = i18nManager.locale(locale)
    const keepsOldTopic =
      row.payload.type === 'guardian_notice' && row.payload.kind === 'topic_rotated'
    const payload = row.payload

    return ntfyMessage(payload, {
      topic: keepsOldTopic || !link ? row.topic : link.ntfy_topic,
      appUrl: env.get('APP_URL'),
      translate: (key, params) => i18n.t(key, params),
      allowActions: Boolean(link?.allow_notification_actions),
      actionTokens:
        payload.type === 'unlock_request' ? unsealActionTokens(payload.sealedActions) : null,
      formatInstant: (iso) =>
        DateTime.fromISO(iso, { zone: 'utc' })
          .setZone(zone)
          .setLocale(locale)
          .toLocaleString(DateTime.DATETIME_MED),
    })
  }
}
