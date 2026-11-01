// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { nextAttemptAfterFailure, outboxErrorSummary } from '#domain/notify/outbox_backoff'
import { NtfyPublisher } from '#services/notify/ntfy_publisher'
import NotificationRenderer, { type OutboxRow } from '#services/notify/notification_renderer'
import { NOTIFICATION_OUTBOX_TABLE } from '#services/guardians/guardian_notices'

export type DispatchResult = 'sent' | 'retry' | 'gave_up' | 'skipped'

/** Rows one tick publishes at most (the rest wait for the next tick). */
export const DISPATCH_BATCH = 50

/**
 * Publishes `notification_outbox` rows to ntfy. Each row is claimed in its
 * own transaction with `FOR UPDATE SKIP LOCKED`, so overlapping containers
 * never send a row twice, and the lock is held through the send: a topic
 * rotation (which moves unsent rows to the new topic) waits for an
 * in-flight send instead of racing it, and the renderer re-reads the
 * link's current topic inside the same transaction.
 *
 * Failures retry after 10 s, 30 s and 2 min; the fourth gives up with
 * `last_error` (a status code or error code, never a topic, URL, token or
 * body). Without NTFY_BASE_URL nothing is claimed: rows wait.
 */
@inject()
export default class OutboxDispatcher {
  constructor(
    protected publisher: NtfyPublisher,
    protected renderer: NotificationRenderer
  ) {}

  /** Publishes due rows until none is left, the batch is done or `signal` aborts. */
  async dispatchDue(now: () => DateTime, signal?: AbortSignal): Promise<number> {
    if (!this.publisher.configured) return 0
    let handled = 0
    while (handled < DISPATCH_BATCH && !signal?.aborted) {
      const result = await db.transaction(async (trx) => {
        const row = (await trx
          .from(NOTIFICATION_OUTBOX_TABLE)
          .whereNull('sent_at')
          .whereNull('gave_up_at')
          .where('next_attempt_at', '<=', now().toJSDate())
          .orderBy('next_attempt_at')
          .orderBy('id')
          .forUpdate()
          .skipLocked()
          .first()) as OutboxRow | null
        return row === null ? null : this.attempt(trx, row, now())
      })
      if (result === null) break
      handled += 1
    }
    return handled
  }

  /**
   * One row right away (the unlock request's in-request publication).
   * Never throws: on any failure the row stays in the outbox for the job.
   */
  async dispatchRow(id: number, now: DateTime): Promise<DispatchResult> {
    if (!this.publisher.configured) return 'skipped'
    try {
      return await db.transaction(async (trx) => {
        const row = (await trx
          .from(NOTIFICATION_OUTBOX_TABLE)
          .where('id', id)
          .whereNull('sent_at')
          .whereNull('gave_up_at')
          .forUpdate()
          .skipLocked()
          .first()) as OutboxRow | null
        return row === null ? 'skipped' : this.attempt(trx, row, now)
      })
    } catch {
      return 'retry'
    }
  }

  protected async attempt(
    trx: TransactionClientContract,
    row: OutboxRow,
    now: DateTime
  ): Promise<DispatchResult> {
    const message = await this.renderer.render(row, trx)
    const published = await this.publisher.publish(message)
    const attempts = row.attempts + 1
    const at = now.toJSDate()
    const query = trx.from(NOTIFICATION_OUTBOX_TABLE).where('id', row.id)

    if (published.ok) {
      await query.update({
        sent_at: at,
        attempts,
        last_error: null,
        payload: trx.raw(`payload - 'sealedActions'`),
      })
      return 'sent'
    }
    const next = nextAttemptAfterFailure(attempts, at)
    const lastError = outboxErrorSummary(published.reason)
    if (next === null) {
      await query.update({
        attempts,
        last_error: lastError,
        gave_up_at: at,
        payload: trx.raw(`payload - 'sealedActions'`),
      })
      return 'gave_up'
    }
    await query.update({ attempts, last_error: lastError, next_attempt_at: next })
    return 'retry'
  }
}
