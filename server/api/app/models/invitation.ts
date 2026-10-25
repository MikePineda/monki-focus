// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import User from '#models/user'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * An admin's invitation. Only the SHA-256 of the link's random part is
 * stored (`tokenHash`, never serialised); the clear link is shown once.
 */
export default class Invitation extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare createdByUserId: number

  @column({ serializeAs: null })
  declare tokenHash: string

  @column()
  declare email: string | null

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime()
  declare usedAt: DateTime | null

  @column()
  declare usedByUserId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare creator: BelongsTo<typeof User>
}
