// SPDX-License-Identifier: AGPL-3.0-or-later
import app from '@adonisjs/core/services/app'
import type { ScheduledJob, TickContext } from '#scheduler/scheduler'
import OutboxDispatcher from '#services/notify/outbox_dispatcher'

export const OUTBOX_DISPATCH_JOB = 'outbox_dispatch'

/**
 * Every tick: publishes the due `notification_outbox` rows to ntfy (rows
 * are claimed with `FOR UPDATE SKIP LOCKED`, so overlapping containers
 * share the work and never send one twice). Stops between rows once the
 * scheduler is stopping.
 */
export class OutboxDispatchJob implements ScheduledJob {
  readonly name = OUTBOX_DISPATCH_JOB

  async tick({ now, signal }: TickContext): Promise<void> {
    if (signal.aborted) return
    const dispatcher = await app.container.make(OutboxDispatcher)
    await dispatcher.dispatchDue(now, signal)
  }
}
