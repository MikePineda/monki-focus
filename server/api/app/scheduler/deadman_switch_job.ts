// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { ScheduledJob, TickContext } from '#scheduler/scheduler'
import SchedulerRuns from '#scheduler/scheduler_runs'
import { overdueAt, wasAnnounced, type DeadmanSubject } from '#domain/devices/deadman_rule'
import { serverDedupeKey } from '#domain/devices/bypass_dedupe_key'
import BypassEventRecorder, { type NewBypassEvent } from '#services/devices/bypass_event_recorder'

export const DEADMAN_JOB = 'deadman'

/** One claimed run per window, instance-wide: overlapping containers do the scan once. */
export const DEADMAN_WINDOW_MINUTES = 5

/** Devices handled per run; the rest wait for the next window. */
const BATCH = 500

interface OverdueRow {
  id: number
  uuid: string
  user_id: number
  last_seen_at: Date
  deadman_hours: number
  announced_offline_at: Date | null
}

const toSeconds = (date: Date) => Math.floor(date.getTime() / 1000)

/** The claim's period: the start of the current 5-minute window (`2026-01-05T09:05`). */
export function deadmanPeriodKey(now: DateTime): string {
  const minute = Math.floor(now.minute / DEADMAN_WINDOW_MINUTES) * DEADMAN_WINDOW_MINUTES
  return now.toUTC().set({ minute, second: 0, millisecond: 0 }).toFormat("yyyy-LL-dd'T'HH:mm")
}

/**
 * The dead-man switch (app/domain/devices/deadman_rule.ts), every tick:
 * claims the current 5-minute window, then stores one `heartbeat_missing`
 * per protected, unrevoked device whose last heartbeat is older than its
 * threshold. The dedupe key names the device and the heartbeat the gap
 * started after, so however many runs see the same gap, it is stored and
 * handed to `BypassAlerts` once; a heartbeat resolves it (and stores
 * `heartbeat_resumed`), and the next gap gets a key of its own.
 */
export class DeadmanSwitchJob implements ScheduledJob {
  readonly name = DEADMAN_JOB

  constructor(
    protected runs = new SchedulerRuns(),
    protected recorder = new BypassEventRecorder()
  ) {}

  async tick({ now, signal }: TickContext): Promise<void> {
    if (signal.aborted) return
    const startedAt = now()
    const claim = await this.runs.claim(
      { job: DEADMAN_JOB, periodKey: deadmanPeriodKey(startedAt) },
      startedAt
    )
    if (!claim) return

    const raised = await this.raise(startedAt)
    await this.runs.finish(claim, now(), { outcome: `raised:${raised}` })
  }

  /** Stores the alerts due at `now`; answers how many were new. */
  async raise(now: DateTime): Promise<number> {
    const result = await db.rawQuery<{ rows: OverdueRow[] }>(
      `SELECT id, uuid, user_id, last_seen_at, deadman_hours, announced_offline_at
         FROM devices
        WHERE revoked_at IS NULL AND protection_active
          AND last_seen_at <= ?::timestamptz - make_interval(hours => deadman_hours)
        ORDER BY last_seen_at
        LIMIT ?`,
      [now.toJSDate(), BATCH]
    )

    const events = result.rows.map((row): NewBypassEvent => {
      const subject: DeadmanSubject = {
        protectionActive: true,
        revoked: false,
        lastSeenAt: toSeconds(row.last_seen_at),
        deadmanHours: row.deadman_hours,
        announcedOfflineAt: row.announced_offline_at ? toSeconds(row.announced_offline_at) : null,
      }
      return {
        wardUserId: row.user_id,
        deviceId: row.id,
        kind: 'heartbeat_missing',
        source: 'server',
        dedupeKey: serverDedupeKey('heartbeat_missing', row.uuid, subject.lastSeenAt),
        occurredAt: new Date(overdueAt(subject) * 1000),
        details: { deadmanHours: row.deadman_hours, announced: wasAnnounced(subject) },
      }
    })
    const stored = await this.recorder.record(events, now.toJSDate())
    return stored.length
  }
}
