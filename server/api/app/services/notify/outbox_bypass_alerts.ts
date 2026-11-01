// SPDX-License-Identifier: AGPL-3.0-or-later
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import Clock from '#services/clock'
import { bypassAlertDedupeKey } from '#domain/notify/notification_payload'
import { BypassAlerts, type RaisedBypassEvent } from '#services/devices/bypass_alerts'
import { NOTIFICATION_OUTBOX_TABLE } from '#services/guardians/guardian_notices'

/**
 * `BypassAlerts` through the ntfy outbox: one neutral `bypass_alert` per
 * guardian link per batch of new events (a batch of 100 client events is
 * one notification, not 100), and `notified_at` on every event handed
 * over. `guardian_*` events are skipped: the link flows already queued
 * their own notice (guardian_notices.ts). The outbox job publishes.
 */
export class OutboxBypassAlerts extends BypassAlerts {
  async raised(events: readonly RaisedBypassEvent[]): Promise<void> {
    const relevant = events.filter((event) => !event.kind.startsWith('guardian_'))
    if (relevant.length === 0) return
    const clock = await app.container.make(Clock)
    const now = clock.now().toJSDate()

    const byWard = new Map<number, RaisedBypassEvent[]>()
    for (const event of relevant) {
      byWard.set(event.wardUserId, [...(byWard.get(event.wardUserId) ?? []), event])
    }

    await db.transaction(async (trx) => {
      for (const [wardUserId, wardEvents] of byWard) {
        const links = await trx
          .from('guardian_links')
          .select('id', 'guardian_user_id', 'ntfy_topic')
          .where('ward_user_id', wardUserId)
          .where('status', 'active')
          .where((deadline) =>
            deadline
              .whereNull('revocation_effective_at')
              .orWhere('revocation_effective_at', '>', now)
          )
        const firstId = Math.min(...wardEvents.map((event) => event.id))
        for (const link of links) {
          await trx
            .table(NOTIFICATION_OUTBOX_TABLE)
            .insert({
              recipient_user_id: link.guardian_user_id,
              channel: 'ntfy',
              topic: link.ntfy_topic,
              payload: JSON.stringify({ type: 'bypass_alert', linkId: link.id }),
              dedupe_key: bypassAlertDedupeKey(firstId, link.id),
              attempts: 0,
              next_attempt_at: now,
              created_at: now,
            })
            .onConflict('dedupe_key')
            .ignore()
        }
        await trx
          .from('bypass_events')
          .whereIn(
            'id',
            wardEvents.map((event) => event.id)
          )
          .whereNull('notified_at')
          .update({ notified_at: now })
      }
    })
  }
}
