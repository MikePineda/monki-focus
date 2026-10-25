// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { AccessToken } from '@adonisjs/auth/access_tokens'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type Device from '#models/device'
import {
  DEVICE_ABILITY,
  DEVICE_TOKEN_PREFIX,
  DEVICE_TOKEN_SECRET_LENGTH,
  DEVICE_TOKEN_TYPE,
} from '#models/device'
import { DeviceApiError } from '#exceptions/device_api_error'
import { isRotationDue, previousTokenValidUntil } from '#domain/devices/token_rotation'

export const ACCESS_TOKENS_TABLE = 'auth_access_tokens'

const TOKEN_NAME = 'device'

const toSeconds = (date: Date) => Math.floor(date.getTime() / 1000)

/**
 * Device access tokens (`mfd_…`): issued at enrolment and on rotation,
 * returned to the caller once and never logged; only their SHA-256 is
 * stored. Every token carries exactly the device ability. Nothing here
 * reads `last_used_at` (the library writes it before checking the secret).
 */
export default class DeviceTokens {
  /**
   * A new permanent token for the device, inserted with the caller's
   * client (so a rotation commits it with everything else). The row has
   * the library's exact shape; the clear value exists only in the answer.
   */
  async issue(device: Device, now: DateTime, trx?: TransactionClientContract): Promise<string> {
    const transient = AccessToken.createTransientToken(device.id, DEVICE_TOKEN_SECRET_LENGTH)
    const at = now.toJSDate()
    const abilities = [DEVICE_ABILITY]
    const [row] = (await (trx ?? db)
      .table(ACCESS_TOKENS_TABLE)
      .insert({
        tokenable_id: device.id,
        type: DEVICE_TOKEN_TYPE,
        name: TOKEN_NAME,
        hash: transient.hash,
        abilities: JSON.stringify(abilities),
        created_at: at,
        updated_at: at,
        last_used_at: null,
        expires_at: null,
      })
      .returning('id')) as Array<{ id: number }>
    const token = new AccessToken({
      identifier: row.id,
      tokenableId: device.id,
      type: DEVICE_TOKEN_TYPE,
      prefix: DEVICE_TOKEN_PREFIX,
      secret: transient.secret,
      name: TOKEN_NAME,
      hash: transient.hash,
      abilities,
      createdAt: at,
      updatedAt: at,
      lastUsedAt: null,
      expiresAt: null,
    })
    return token.value!.release()
  }

  /**
   * Rotation (`POST /device/token/rotate`):
   *
   * 1. one atomic `UPDATE … SET expires_at = <grace> WHERE … expires_at IS
   *    NULL` claims the calling token: of any number of concurrent calls,
   *    exactly one wins, and a token already in its grace (or rotated) can
   *    never rotate again (409 `token_rotation_refused`);
   * 2. then one transaction, holding the device row (`FOR UPDATE`),
   *    deletes every other token of the device and inserts the new one.
   *
   * The device therefore never has more than one permanent token. If step
   * 2 fails, the claim is undone so the device keeps its token.
   */
  async rotate(device: Device, current: AccessToken, now: DateTime): Promise<string> {
    const currentId = String(current.identifier)
    const graceEnd = new Date(previousTokenValidUntil(Math.floor(now.toSeconds())) * 1000)
    const claimed = (await db
      .from(ACCESS_TOKENS_TABLE)
      .where('id', currentId)
      .where('tokenable_id', device.id)
      .whereNull('expires_at')
      .update({ expires_at: graceEnd, updated_at: now.toJSDate() })
      .returning(['id'])) as Array<{ id: number }>
    if (claimed.length === 0) throw new DeviceApiError('token_rotation_refused', 409)

    try {
      return await db.transaction(async (trx) => {
        await trx.from('devices').where('id', device.id).forUpdate().select('id')
        await trx
          .from(ACCESS_TOKENS_TABLE)
          .where('tokenable_id', device.id)
          .whereNot('id', currentId)
          .delete()
        return this.issue(device, now, trx)
      })
    } catch (error) {
      await db.from(ACCESS_TOKENS_TABLE).where('id', currentId).update({ expires_at: null })
      throw error
    }
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
