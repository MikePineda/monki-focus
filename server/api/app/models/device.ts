// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import User from '#models/user'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DbAccessTokensProvider, type AccessToken } from '@adonisjs/auth/access_tokens'
import type { DevicePlatform } from '#domain/devices/device_platform'
import type { RiskState } from '#domain/devices/risk_state'
import type { KidsByPurpose } from '#domain/devices/key_pin_check'

/** Prefix of every device token, so a leaked one is recognisable (and scannable). */
export const DEVICE_TOKEN_PREFIX = 'mfd_'

/** The one ability a device token carries; the `auth` middleware requires it. */
export const DEVICE_ABILITY = 'device:*'

/** Random characters behind each token (about 288 bits), plus a CRC32 checksum. */
export const DEVICE_TOKEN_SECRET_LENGTH = 48

/** `auth_access_tokens.type` of device tokens. */
export const DEVICE_TOKEN_TYPE = 'device_token'

const jsonColumn = {
  prepare: (value: unknown) => (value === null ? null : JSON.stringify(value)),
  consume: (value: unknown) => value,
}

/**
 * An enrolled device: the tokenable of the `device` guard (Bearer `mfd_…`
 * access tokens, config/auth.ts), owned by a user. The token's secret is
 * stored only as a SHA-256 (`auth_access_tokens.hash`) and returned once.
 * A revoked device keeps its row (history) but has no token left, and the
 * `auth` middleware refuses it anyway.
 */
export default class Device extends BaseModel {
  static accessTokens = DbAccessTokensProvider.forModel(Device, {
    prefix: DEVICE_TOKEN_PREFIX,
    table: 'auth_access_tokens',
    type: DEVICE_TOKEN_TYPE,
    tokenSecretLength: DEVICE_TOKEN_SECRET_LENGTH,
  })

  /** Set by the `device` guard on the authenticated request. */
  declare currentAccessToken?: AccessToken

  @column({ isPrimary: true, serializeAs: null })
  declare id: number

  @column()
  declare uuid: string

  @column({ serializeAs: null })
  declare userId: number

  @column()
  declare name: string

  @column()
  declare platform: DevicePlatform

  @column()
  declare clientVersion: string

  @column()
  declare rulesHash: string | null

  @column()
  declare policyHash: string | null

  @column()
  declare protectionActive: boolean

  @column({ columnName: 'a11y_enabled' })
  declare a11yEnabled: boolean | null

  @column(jsonColumn)
  declare riskState: RiskState[]

  @column(jsonColumn)
  declare enrolledKids: KidsByPurpose

  @column(jsonColumn)
  declare pinnedKids: KidsByPurpose | null

  @column()
  declare keyPinMismatch: boolean

  @column()
  declare deadmanHours: number

  @column({ serializeAs: null })
  declare lastBoot: string | null

  @column.dateTime()
  declare lastSeenAt: DateTime

  @column.dateTime()
  declare announcedOfflineAt: DateTime | null

  @column()
  declare clockOffsetMs: number | null

  @column.dateTime()
  declare revokedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
