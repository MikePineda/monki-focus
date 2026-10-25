// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApplicationService } from '@adonisjs/core/types'
import type { ScheduledJob } from '#scheduler/scheduler'
import { DeadmanSwitchJob } from '#scheduler/deadman_switch_job'
import { DeviceRetentionJob } from '#scheduler/device_retention_job'
import { WardRevocationJob } from '#scheduler/ward_revocation_job'

/**
 * Every recurring job, in tick order. The production scheduler
 * (providers/scheduler_provider.ts) and the test-support tick route both run
 * this list: the dead-man switch and device data retention (S4), the end
 * of guardian links whose ward's cooldown ran out (S5); unlock expiry and
 * the ntfy outbox (S6), goals and reports (phase 4) join later.
 */
export async function scheduledJobs(_app: ApplicationService): Promise<ScheduledJob[]> {
  return [new DeadmanSwitchJob(), new DeviceRetentionJob(), new WardRevocationJob()]
}
