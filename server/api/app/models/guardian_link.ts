// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { linkState, type LinkState, type StoredLinkStatus } from '#domain/guardians/link_state'

/**
 * A row of `guardian_links` (database/migrations/…_create_guardian_links_table.ts).
 * Loaded only through the ward or the guardian
 * (app/services/guardians/guardian_link_registry.ts). The topic is a
 * capability: never serialised, only handed to the guardian on purpose.
 */
export default class GuardianLink extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare wardUserId: number

  @column()
  declare guardianUserId: number

  @column()
  declare status: StoredLinkStatus

  @column({ serializeAs: null })
  declare ntfyTopic: string

  @column()
  declare maxUnlockMinutes: number

  @column()
  declare allowNotificationActions: boolean

  @column.dateTime()
  declare confirmedAt: DateTime | null

  @column.dateTime()
  declare revocationRequestedAt: DateTime | null

  @column.dateTime()
  declare revocationEffectiveAt: DateTime | null

  @column.dateTime()
  declare revokedAt: DateTime | null

  @column({ serializeAs: null })
  declare revokedByUserId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  stateAt(now: DateTime): LinkState {
    return linkState(
      {
        status: this.status,
        revocationEffectiveAt: this.revocationEffectiveAt?.toJSDate() ?? null,
      },
      now.toJSDate()
    )
  }
}
