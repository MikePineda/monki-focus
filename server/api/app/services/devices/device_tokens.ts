// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { AccessToken } from '@adonisjs/auth/access_tokens'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Device, { DEVICE_ABILITY } from '#models/device'
import { isRotationDue, previousTokenValidUntil } from '#domain/devices/token_rotation'

export const ACCESS_TOKENS_TABLE = 'auth_access_tokens'

const toSeconds = (date: Date) => Math.floor(date.getTime() / 1000)

/**
 * Device access tokens (`mfd_…`): issued at enrolment and on rotation,
 * returned to the caller once and never logged; only their SHA-256 is
 * stored. Every token carries exactly the device ability.
 */
export default class DeviceTokens {
  /** A new token for the device. The clear value is only in the returned object. */
  async issue(device: Device): Promise<string> {
    const token = await Device.accessTokens.create(device, [DEVICE_ABILITY], { name: 'device' })
    return token.value!.release()
  }

  /**
   * Rotation (`POST /device/token/rotate`): a new token, every other token
   * of the device deleted, and the one used for this call kept only for a
   * short grace, so a lost response can be retried with it. A retry never
   * extends that grace (app/domain/devices/token_rotation.ts).
   */
  async rotate(device: Device, current: AccessToken, now: DateTime): Promise<string> {
    const validUntil = previousTokenValidUntil(
      Math.floor(now.toSeconds()),
      current.expiresAt === null ? null : toSeconds(current.expiresAt)
    )
    await db
      .from(ACCESS_TOKENS_TABLE)
      .where('tokenable_id', device.id)
      .whereNot('id', String(current.identifier))
      .delete()
    await db
      .from(ACCESS_TOKENS_TABLE)
      .where('id', String(current.identifier))
      .update({ expires_at: new Date(validUntil * 1000), updated_at: now.toJSDate() })
    return this.issue(device)
  }

  /** Revocation: every token of the device, gone (in the caller's transaction). */
  async revokeAll(device: Device, trx: TransactionClientContract): Promise<void> {
    await trx.from(ACCESS_TOKENS_TABLE).where('tokenable_id', device.id).delete()
  }

  /** The client hint of every heartbeat: rotate once the token is 30 days old. */
  rotationDue(current: AccessToken, now: DateTime): boolean {
    return isRotationDue(toSeconds(current.createdAt), Math.floor(now.toSeconds()))
  }
}
