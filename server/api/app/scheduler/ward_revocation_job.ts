// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import type { ScheduledJob, TickContext } from '#scheduler/scheduler'
import LinkRevocationService from '#services/guardians/link_revocation_service'

export const WARD_REVOCATION_JOB = 'ward_revocation_effective'

/**
 * Every tick: stores the end of each guardian link whose ward's
 * revocation deadline has passed (`pairing_ended` notice to the guardian,
 * `guardian_unlinked` in the ward's log). Access already ended at the
 * deadline (every lookup reads it); this only writes the final state.
 * No claim needed: the links are taken with `FOR UPDATE SKIP LOCKED` and
 * only while still `active`, so overlapping containers finish each once.
 */
export class WardRevocationJob implements ScheduledJob {
  readonly name = WARD_REVOCATION_JOB

  async tick({ now, signal }: TickContext): Promise<void> {
    if (signal.aborted) return
    await this.finalizeDue(now())
  }

  async finalizeDue(now: DateTime): Promise<number> {
    const revocation = await app.container.make(LinkRevocationService)
    return revocation.finalizeDue(now)
  }
}
