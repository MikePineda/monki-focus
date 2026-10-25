// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import type { SupportedLocale } from '#http/supported_locales'

/**
 * A dashboard account. `password` is hashed on save (scrypt, config/hash.ts)
 * and, like the TOTP secret, never serialised. `sessionVersion` is the
 * revocation counter the `auth` middleware compares with every session.
 * The hasher is resolved lazily: commands and seeders import this model
 * before the hash service has booted.
 */
export default class User extends compose(
  BaseModel,
  withAuthFinder(() => hash.use(), { uids: ['email'], passwordColumnName: 'password' })
) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare email: string

  @column()
  declare fullName: string | null

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare locale: SupportedLocale

  @column()
  declare timeZone: string

  @column()
  declare weekStart: number

  @column()
  declare isAdmin: boolean

  /** Created through a guardian pairing code: may only guard while registration is closed. */
  @column()
  declare guardianOnly: boolean

  @column({ serializeAs: null })
  declare sessionVersion: number

  @column({ serializeAs: null })
  declare totpSecretEncrypted: string | null

  @column.dateTime({ serializeAs: null })
  declare totpEnabledAt: DateTime | null

  /** bigint, read as a number (providers/pg_types_provider.ts). */
  @column({ serializeAs: null })
  declare totpLastUsedStep: number | null

  @column({ serializeAs: null })
  declare ntfyTopic: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  get twoFactorEnabled(): boolean {
    return Boolean(this.totpEnabledAt)
  }
}
