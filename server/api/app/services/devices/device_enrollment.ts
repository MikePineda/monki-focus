// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUID } from 'node:crypto'
import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import Device from '#models/device'
import { DeviceApiError } from '#exceptions/device_api_error'
import { digestsMatch } from '#domain/accounts/one_way_digest'
import { serverDedupeKey } from '#domain/devices/bypass_dedupe_key'
import { hasRoomForAnotherDevice } from '#domain/devices/device_quota'
import { DEADMAN_HOURS_DEFAULT } from '#domain/devices/deadman_rule'
import type { DevicePlatform } from '#domain/devices/device_platform'
import {
  ENROLLMENT_CODE_MAX_ATTEMPTS,
  enrollmentCodeDigests,
} from '#domain/devices/enrollment_code'
import type { KeySet } from '#domain/keys/key_set'
import { throttleFailures } from '#services/accounts/failure_throttle'
import BypassEventRecorder from '#services/devices/bypass_event_recorder'
import DeviceTokens from '#services/devices/device_tokens'
import { enrollmentRules } from '#services/devices/device_throttles'
import { ENROLLMENT_CODES_TABLE, enrollmentPepper } from '#services/devices/enrollment_code_service'
import { publishedKeys } from '#services/devices/published_keys'

export interface EnrollmentRequest {
  readonly code: string
  readonly name: string
  readonly platform: DevicePlatform
  readonly clientVersion: string
}

export interface Enrollment {
  readonly device: Device
  /** The device token, returned exactly once. */
  readonly token: string
  /** What the device pins (only if every kid equals one the dashboard showed it). */
  readonly keys: KeySet
}

interface ReservedCode {
  id: number
  user_id: number
  code_hash: string
}

/** Every refusal looks the same: wrong, expired, used or locked code. */
const invalidCode = () => new DeviceApiError('invalid_enrollment_code', 400)

/**
 * `POST /device/enroll`: trades a one-time code for a device and its
 * token. Each guess is paid for **before** it is evaluated, twice:
 *
 * 1. the per-IP failure throttle (`throttleFailures`, reserve-first);
 * 2. the code's own counter: one atomic `UPDATE ... attempts + 1 ...
 *    WHERE attempts < 5 RETURNING` reserves the attempt, so of any number
 *    of concurrent guesses at most 5 are ever compared and the fifth wrong
 *    one kills the code.
 *
 * Only then is the whole code's HMAC compared (constant time). A right
 * code is consumed (`used_at`, guarded against a concurrent winner), the
 * device is created with the kids it is about to pin, a `device_enrolled`
 * event is stored for the guardian, and the token is issued.
 */
@inject()
export default class DeviceEnrollment {
  constructor(
    protected tokens: DeviceTokens,
    protected events: BypassEventRecorder
  ) {}

  async enroll(request: EnrollmentRequest, ip: string, now: DateTime): Promise<Enrollment> {
    const { lookupHash, codeHash } = enrollmentCodeDigests(request.code, enrollmentPepper())

    const reserved = await throttleFailures(enrollmentRules(ip), async () => {
      const result = await db.rawQuery<{ rows: ReservedCode[] }>(
        `UPDATE ${ENROLLMENT_CODES_TABLE} SET attempts = attempts + 1
          WHERE lookup_hash = ? AND used_at IS NULL AND expires_at > ? AND attempts < ?
          RETURNING id, user_id, code_hash`,
        [lookupHash, now.toJSDate(), ENROLLMENT_CODE_MAX_ATTEMPTS]
      )
      const row = result.rows[0]
      if (!row || !digestsMatch(row.code_hash, codeHash)) throw invalidCode()
      return row
    })

    const keys = await publishedKeys()
    const device = await db.transaction(async (trx) => {
      const consumed = await trx
        .from(ENROLLMENT_CODES_TABLE)
        .where('id', reserved.id)
        .whereNull('used_at')
        .update({ used_at: now.toJSDate() })
      // A concurrent request with the same right code won the race.
      if ((Array.isArray(consumed) ? consumed.length : Number(consumed)) === 0) throw invalidCode()

      const active = await Device.query({ client: trx })
        .where('user_id', reserved.user_id)
        .whereNull('revoked_at')
        .count('* as total')
      if (!hasRoomForAnotherDevice(Number(active[0].$extras.total))) {
        throw new DeviceApiError('device_limit_reached', 409)
      }

      const created = await Device.create(
        {
          uuid: randomUUID(),
          userId: reserved.user_id,
          name: request.name,
          platform: request.platform,
          clientVersion: request.clientVersion,
          rulesHash: null,
          policyHash: null,
          protectionActive: false,
          a11yEnabled: null,
          riskState: [],
          enrolledKids: keys.kids,
          pinnedKids: null,
          keyPinMismatch: false,
          deadmanHours: env.get('DEADMAN_DEFAULT_HOURS') ?? DEADMAN_HOURS_DEFAULT,
          lastBoot: null,
          lastSeenAt: now,
          announcedOfflineAt: null,
          clockOffsetMs: null,
          revokedAt: null,
        },
        { client: trx }
      )
      await trx
        .from(ENROLLMENT_CODES_TABLE)
        .where('id', reserved.id)
        .update({ device_id: created.id })
      await this.events.record(
        [
          {
            wardUserId: created.userId,
            deviceId: created.id,
            kind: 'device_enrolled',
            source: 'server',
            dedupeKey: serverDedupeKey('device_enrolled', created.uuid),
            occurredAt: now.toJSDate(),
            details: { platform: created.platform },
          },
        ],
        now.toJSDate(),
        trx
      )
      return created
    })

    // After the commit: the token row references the committed device.
    const token = await this.tokens.issue(device)
    return { device, token, keys: keys.keySet }
  }
}
