// SPDX-License-Identifier: AGPL-3.0-or-later
import app from '@adonisjs/core/services/app'
import type { ScheduledJob, TickContext } from '#scheduler/scheduler'
import UnlockRequestExpiry from '#services/unlock/unlock_request_expiry'

export const EXPIRE_UNLOCK_REQUESTS_JOB = 'expire_unlock_requests'

/**
 * Every tick: pending unlock requests past their deadline become
 * `expired` and lose their action capabilities. No claim needed: one
 * idempotent UPDATE.
 */
export class ExpireUnlockRequestsJob implements ScheduledJob {
  readonly name = EXPIRE_UNLOCK_REQUESTS_JOB

  async tick({ now, signal }: TickContext): Promise<void> {
    if (signal.aborted) return
    const expiry = await app.container.make(UnlockRequestExpiry)
    await expiry.expireDue(now())
  }
}
