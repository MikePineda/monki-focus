// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { BypassKind, BypassSource } from '#domain/devices/bypass_event_kinds'
import type { BypassDetails } from '#domain/devices/bypass_event_details'

/**
 * A row of the bypass log (database/migrations/…_create_bypass_events_table.ts).
 * Written only through app/services/devices/bypass_event_recorder.ts; the
 * dedupe key is internal and never serialised.
 */
export default class BypassEvent extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ serializeAs: null })
  declare wardUserId: number

  @column({ serializeAs: null })
  declare deviceId: number | null

  @column()
  declare kind: BypassKind

  @column()
  declare source: BypassSource

  @column({ serializeAs: null })
  declare dedupeKey: string

  @column.dateTime()
  declare occurredAt: DateTime

  @column.dateTime()
  declare resolvedAt: DateTime | null

  @column({
    prepare: (value: unknown) => JSON.stringify(value ?? {}),
    consume: (value: unknown) => value,
  })
  declare details: BypassDetails

  @column.dateTime()
  declare notifiedAt: DateTime | null

  @column.dateTime()
  declare acknowledgedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
