// SPDX-License-Identifier: AGPL-3.0-or-later
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { BypassKind, BypassSource } from '#domain/devices/bypass_event_kinds'
import type { BypassDetails } from '#domain/devices/bypass_event_details'
import { BypassAlerts, type RaisedBypassEvent } from '#services/devices/bypass_alerts'

export const BYPASS_EVENTS_TABLE = 'bypass_events'

export interface NewBypassEvent {
  readonly wardUserId: number
  readonly deviceId: number | null
  readonly kind: BypassKind
  readonly source: BypassSource
  /** Already namespaced (app/domain/devices/bypass_dedupe_key.ts). */
  readonly dedupeKey: string
  readonly occurredAt: Date
  readonly details: BypassDetails
}

interface InsertedRow {
  id: number
  ward_user_id: number
  device_id: number | null
  kind: BypassKind
  source: BypassSource
  occurred_at: Date
}

/**
 * The only writer of `bypass_events`. Inserts are idempotent per user and
 * dedupe key (`ON CONFLICT DO NOTHING`), so a re-sent batch, two containers
 * running the dead-man job or two concurrent heartbeats store each event
 * once. Only the rows actually inserted are handed to the `BypassAlerts`
 * port, after the caller's transaction (if any) commits.
 */
export default class BypassEventRecorder {
  /** Stores the events; answers the ones that were new. */
  async record(
    events: readonly NewBypassEvent[],
    now: Date,
    trx?: TransactionClientContract
  ): Promise<RaisedBypassEvent[]> {
    if (events.length === 0) return []
    const rows = events.map((event) => ({
      ward_user_id: event.wardUserId,
      device_id: event.deviceId,
      kind: event.kind,
      source: event.source,
      dedupe_key: event.dedupeKey,
      occurred_at: event.occurredAt,
      details: JSON.stringify(event.details),
      created_at: now,
    }))
    const inserted = (await (trx ?? db)
      .table(BYPASS_EVENTS_TABLE)
      .insert(rows)
      .onConflict(['ward_user_id', 'dedupe_key'])
      .ignore()
      .returning([
        'id',
        'ward_user_id',
        'device_id',
        'kind',
        'source',
        'occurred_at',
      ])) as InsertedRow[]

    const raised = inserted.map((row): RaisedBypassEvent => ({
      id: row.id,
      wardUserId: row.ward_user_id,
      deviceId: row.device_id,
      kind: row.kind,
      source: row.source,
      occurredAt: row.occurred_at,
    }))
    if (raised.length > 0) {
      // The rows are stored either way: a failing port never fails the request or the job.
      const announce = () =>
        app.container
          .make(BypassAlerts)
          .then((alerts) => alerts.raised(raised))
          .catch((error) =>
            logger.error({ err: error, events: raised.length }, 'bypass alerts: hand-off failed')
          )
      if (trx) trx.after('commit', () => void announce())
      else await announce()
    }
    return raised
  }
}
