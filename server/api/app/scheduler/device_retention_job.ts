// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import type { ScheduledJob, TickContext } from '#scheduler/scheduler'
import SchedulerRuns, { SCHEDULER_RUNS_TABLE } from '#scheduler/scheduler_runs'
import { DEADMAN_JOB } from '#scheduler/deadman_switch_job'
import { ENROLLMENT_CODES_TABLE } from '#services/devices/enrollment_code_service'
import { ACCESS_TOKENS_TABLE } from '#services/devices/device_tokens'
import { DEVICE_HEARTBEATS_TABLE } from '#services/devices/heartbeat_service'
import { PAIRING_CODES_TABLE } from '#services/guardians/pairing_code_reservation'

export const DEVICE_RETENTION_JOB = 'device_retention'

/** HEARTBEAT_RETENTION_DAYS when unset. */
export const DEFAULT_HEARTBEAT_RETENTION_DAYS = 30

/** Rows deleted per statement, so a large backlog never holds long locks. */
const BATCH = 5000

export interface RetentionResult {
  heartbeats: number
  enrollmentCodes: number
  pairingCodes: number
  accessTokens: number
  schedulerRuns: number
}

/**
 * Daily (one claimed run per UTC day, instance-wide), in batches:
 *
 * - heartbeats older than HEARTBEAT_RETENTION_DAYS (default 30);
 * - enrolment codes a day after they expired (used or not; a used code's
 *   device keeps its own history), and guardian pairing codes alike (a
 *   used code's link keeps its own);
 * - device tokens past their expiry (the grace of a rotated token);
 * - dead-man claims older than two days (one per 5-minute window).
 *
 * Bypass events are the audit log and are never pruned here.
 */
export class DeviceRetentionJob implements ScheduledJob {
  readonly name = DEVICE_RETENTION_JOB

  constructor(protected runs = new SchedulerRuns()) {}

  async tick({ now, signal }: TickContext): Promise<void> {
    if (signal.aborted) return
    const startedAt = now()
    const claim = await this.runs.claim(
      { job: DEVICE_RETENTION_JOB, periodKey: startedAt.toUTC().toISODate()! },
      startedAt
    )
    if (!claim) return

    const pruned = await this.prune(startedAt)
    await this.runs.finish(claim, now(), { outcome: `pruned:${pruned.heartbeats}` })
  }

  async prune(now: DateTime): Promise<RetentionResult> {
    const days = env.get('HEARTBEAT_RETENTION_DAYS') ?? DEFAULT_HEARTBEAT_RETENTION_DAYS
    return {
      heartbeats: await deleteInBatches(
        DEVICE_HEARTBEATS_TABLE,
        'received_at < ?',
        now.minus({ days }).toJSDate()
      ),
      enrollmentCodes: await deleteInBatches(
        ENROLLMENT_CODES_TABLE,
        'expires_at < ?',
        now.minus({ days: 1 }).toJSDate()
      ),
      pairingCodes: await deleteInBatches(
        PAIRING_CODES_TABLE,
        'expires_at < ?',
        now.minus({ days: 1 }).toJSDate()
      ),
      accessTokens: await deleteInBatches(ACCESS_TOKENS_TABLE, 'expires_at < ?', now.toJSDate()),
      schedulerRuns: await deleteInBatches(
        SCHEDULER_RUNS_TABLE,
        `job = '${DEADMAN_JOB}' AND started_at < ?`,
        now.minus({ days: 2 }).toJSDate()
      ),
    }
  }
}

/** `DELETE ... WHERE <condition>` in batches of 5000; answers the rows deleted. */
async function deleteInBatches(table: string, condition: string, bound: Date): Promise<number> {
  let total = 0
  for (;;) {
    const result = await db.rawQuery<{ rowCount: number }>(
      `DELETE FROM ${table} WHERE id IN (SELECT id FROM ${table} WHERE ${condition} LIMIT ${BATCH})`,
      [bound]
    )
    total += result.rowCount
    if (result.rowCount < BATCH) return total
  }
}
