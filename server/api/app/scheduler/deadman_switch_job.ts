// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { ScheduledJob, TickContext } from '#scheduler/scheduler'
import SchedulerRuns from '#scheduler/scheduler_runs'
import { overdueAt, wasAnnounced, type DeadmanSubject } from '#domain/devices/deadman_rule'
import { serverDedupeKey } from '#domain/devices/bypass_dedupe_key'
import BypassEventRecorder, { BYPASS_EVENTS_TABLE } from '#services/devices/bypass_event_recorder'
import type { RaisedBypassEvent } from '#services/devices/bypass_alerts'

export const DEADMAN_JOB = 'deadman'

/** One claimed run per window, instance-wide: overlapping containers do the scan once. */
export const DEADMAN_WINDOW_MINUTES = 5

/** Devices handled per run; the rest wait for the next window. */
const BATCH = 500

export interface OverdueRow {
  id: number
  uuid: string
  user_id: number
  last_seen_at: Date
  deadman_hours: number
  announced_offline_at: Date | null
}

interface InsertedRow {
  id: number
  ward_user_id: number
  occurred_at: Date
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
    return this.alert(await this.overdue(now), now)
  }

  /**
   * Protected, unrevoked devices past their threshold that have no open
   * `heartbeat_missing` yet, oldest first. Already alerted devices are left
   * out, so however many devices stay silent for good, a batch always
   * reaches the newly overdue ones.
   */
  async overdue(now: DateTime): Promise<OverdueRow[]> {
    const result = await db.rawQuery<{ rows: OverdueRow[] }>(
      `SELECT d.id, d.uuid, d.user_id, d.last_seen_at, d.deadman_hours, d.announced_offline_at
         FROM devices d
        WHERE d.revoked_at IS NULL AND d.protection_active
          AND d.last_seen_at <= ?::timestamptz - make_interval(hours => d.deadman_hours)
          AND NOT EXISTS (
            SELECT 1 FROM ${BYPASS_EVENTS_TABLE} e
             WHERE e.device_id = d.id AND e.kind = 'heartbeat_missing' AND e.resolved_at IS NULL)
        ORDER BY d.last_seen_at
        LIMIT ?`,
      [now.toJSDate(), BATCH]
    )
    return result.rows
  }

  /**
   * One conditional insert per device: under the row's lock the device must
   * still be overdue (the scan's condition, re-checked), protected and not
   * revoked. A heartbeat that landed after the scan (it takes the same lock
   * first) moved `last_seen_at` forward, so it never gets a false
   * `heartbeat_missing`. No equality on timestamps: a write with a finer
   * precision than the scan read can never make a device fail open.
   */
  async alert(rows: readonly OverdueRow[], now: DateTime): Promise<number> {
    const raised: RaisedBypassEvent[] = []
    for (const row of rows) {
      const subject: DeadmanSubject = {
        protectionActive: true,
        revoked: false,
        lastSeenAt: toSeconds(row.last_seen_at),
        deadmanHours: row.deadman_hours,
        announcedOfflineAt: row.announced_offline_at ? toSeconds(row.announced_offline_at) : null,
      }
      const details = { deadmanHours: row.deadman_hours, announced: wasAnnounced(subject) }
      const inserted = await db.rawQuery<{ rows: InsertedRow[] }>(
        `INSERT INTO ${BYPASS_EVENTS_TABLE}
           (ward_user_id, device_id, kind, source, dedupe_key, occurred_at, details, created_at)
         SELECT d.user_id, d.id, 'heartbeat_missing', 'server', ?, ?, ?::jsonb, ?
           FROM devices d
          WHERE d.id = ? AND d.revoked_at IS NULL AND d.protection_active
            AND d.last_seen_at <= ?::timestamptz - make_interval(hours => d.deadman_hours)
            FOR UPDATE
         ON CONFLICT (ward_user_id, dedupe_key) DO NOTHING
         RETURNING id, ward_user_id, occurred_at`,
        [
          serverDedupeKey('heartbeat_missing', row.uuid, subject.lastSeenAt),
          new Date(overdueAt(subject) * 1000),
          JSON.stringify(details),
          now.toJSDate(),
          row.id,
          now.toJSDate(),
        ]
      )
      for (const stored of inserted.rows) {
        raised.push({
          id: stored.id,
          wardUserId: stored.ward_user_id,
          deviceId: row.id,
          kind: 'heartbeat_missing',
          source: 'server',
          occurredAt: stored.occurred_at,
        })
      }
    }
    await this.recorder.announce(raised)
    return raised.length
  }
}
