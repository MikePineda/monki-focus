// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { UnlockScope } from '@monki-focus/protocol'
import type {
  DecisionChannel,
  UnlockRequestStatus,
  UnlockRequestTimeline,
} from '#domain/unlock/unlock_request_state'

const jsonColumn = {
  prepare: (value: unknown) => (value === null ? null : JSON.stringify(value)),
  consume: (value: unknown) => value,
}

/**
 * A device's request to lift one scope (database/migrations/
 * 1793000000601_create_unlock_requests_table.ts). Action hashes and the
 * sealed token never leave the server.
 */
export default class UnlockRequest extends BaseModel {
  @column({ isPrimary: true, serializeAs: null })
  declare id: number

  @column()
  declare uuid: string

  @column({ serializeAs: null })
  declare wardUserId: number

  @column({ serializeAs: null })
  declare deviceId: number

  @column({ serializeAs: null })
  declare guardianLinkId: number | null

  @column()
  declare ruleId: string

  @column(jsonColumn)
  declare scope: UnlockScope

  @column()
  declare requestedMinutes: number

  @column()
  declare grantedMinutes: number | null

  @column()
  declare reason: string | null

  @column({ serializeAs: null })
  declare policyHash: string

  @column()
  declare status: UnlockRequestStatus

  @column({ serializeAs: null })
  declare approveActionHash: string | null

  @column({ serializeAs: null })
  declare denyActionHash: string | null

  @column.dateTime({ serializeAs: null })
  declare actionExpiresAt: DateTime | null

  @column({ serializeAs: null })
  declare tokenSealed: string | null

  @column({ serializeAs: null })
  declare decidedByUserId: number | null

  @column()
  declare decidedVia: DecisionChannel | null

  @column.dateTime()
  declare decidedAt: DateTime | null

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  timeline(): UnlockRequestTimeline {
    return { status: this.status, expiresAt: this.expiresAt.toJSDate() }
  }
}
