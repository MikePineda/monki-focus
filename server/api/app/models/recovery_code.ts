// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/** One two-factor recovery code of a user, stored as its SHA-256 only. */
export default class RecoveryCode extends BaseModel {
  static table = 'user_recovery_codes'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column({ serializeAs: null })
  declare codeHash: string

  @column.dateTime()
  declare usedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
