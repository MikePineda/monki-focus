// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApplicationService } from '@adonisjs/core/types'
import type { ScheduledJob } from '#scheduler/scheduler'

/**
 * Every recurring job, in tick order. The production scheduler
 * (providers/scheduler_provider.ts) and the test-support tick route both run
 * this list. Empty until the jobs land: unlock expiry and the ntfy outbox
 * (S6), the dead-man check (S7), pruning, goals and reports (phase 4).
 */
export async function scheduledJobs(_app: ApplicationService): Promise<ScheduledJob[]> {
  return []
}
