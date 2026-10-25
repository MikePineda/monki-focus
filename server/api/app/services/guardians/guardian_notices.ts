// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import {
  guardianNoticeDedupeKey,
  guardianNoticePayload,
  type GuardianNotice,
} from '#domain/guardians/guardian_notice'

export const NOTIFICATION_OUTBOX_TABLE = 'notification_outbox'

/** What a notice needs of its link: who hears it and where. */
export interface NoticeTarget {
  readonly id: number
  readonly guardianUserId: number
  readonly ntfyTopic: string
}

/**
 * Queues neutral notices for a link's guardian in `notification_outbox`,
 * inside the caller's transaction: the notice exists exactly when the
 * change it announces commits. Publishing is the ntfy notifier's job (S6),
 * which renders the reason code in the guardian's language. Idempotent per
 * dedupe key (link, kind, instant).
 */
export default class GuardianNotices {
  async queue(
    trx: TransactionClientContract,
    target: NoticeTarget,
    notice: GuardianNotice,
    now: DateTime,
    topic: string = target.ntfyTopic
  ): Promise<void> {
    const at = now.toJSDate()
    await trx
      .table(NOTIFICATION_OUTBOX_TABLE)
      .insert({
        recipient_user_id: target.guardianUserId,
        channel: 'ntfy',
        topic,
        payload: JSON.stringify(guardianNoticePayload(notice)),
        dedupe_key: guardianNoticeDedupeKey(notice.linkId, notice.kind, at),
        attempts: 0,
        next_attempt_at: at,
        created_at: at,
      })
      .onConflict('dedupe_key')
      .ignore()
  }

  /** Moves every unsent row of a rotated topic to the new one: nothing new goes to the old topic. */
  async retarget(trx: TransactionClientContract, from: string, to: string): Promise<void> {
    await trx
      .from(NOTIFICATION_OUTBOX_TABLE)
      .where('topic', from)
      .whereNull('sent_at')
      .update({ topic: to })
  }
}
