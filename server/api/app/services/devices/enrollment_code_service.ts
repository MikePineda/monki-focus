// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomBytes } from 'node:crypto'
import env from '#start/env'
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'
import Device from '#models/device'
import { CodedError } from '#exceptions/coded_error'
import { ownedBy } from '#services/tenancy/owned_by'
import { hasRoomForAnotherDevice } from '#domain/devices/device_quota'
import {
  ENROLLMENT_CODE_BYTES,
  ENROLLMENT_CODE_MAX_ATTEMPTS,
  ENROLLMENT_CODE_TTL_MINUTES,
  enrollmentCodeDigests,
  enrollmentCodeFromBytes,
} from '#domain/devices/enrollment_code'
import { consumeEnrollmentCodeCreation } from '#services/devices/device_throttles'

export const ENROLLMENT_CODES_TABLE = 'device_enrollment_codes'

/** Fresh codes drawn before giving up on a lookup part that is taken (vanishingly rare). */
const MAX_DRAWS = 8

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = '23505'

export interface IssuedEnrollmentCode {
  /** Shown once in the dashboard, never stored or logged in clear. */
  readonly code: string
  readonly expiresAt: DateTime
}

/** The instance secret behind every enrolment-code HMAC. */
export function enrollmentPepper(): string {
  return env.get('APP_KEY').release()
}

/**
 * Dashboard side of enrolment: a signed-in user asks for a code to type on
 * a new device. One pending code per user (a new one replaces the old), 10
 * per hour, and none once the user has 20 active devices. The code is
 * returned once and stored only as its two HMACs
 * (app/domain/devices/enrollment_code.ts).
 */
export default class EnrollmentCodeService {
  async create(user: User, now: DateTime): Promise<IssuedEnrollmentCode> {
    await consumeEnrollmentCodeCreation(user.id)

    const active = await ownedBy(Device, user).whereNull('revoked_at').count('* as total')
    if (!hasRoomForAnotherDevice(Number(active[0].$extras.total))) {
      throw new CodedError('E_DEVICE_LIMIT_REACHED', 409, 'Too many devices')
    }

    const expiresAt = now.plus({ minutes: ENROLLMENT_CODE_TTL_MINUTES })
    // Only one pending code per user: the previous one stops working.
    await db.from(ENROLLMENT_CODES_TABLE).where('user_id', user.id).whereNull('used_at').delete()

    for (let draw = 0; draw < MAX_DRAWS; draw++) {
      const code = enrollmentCodeFromBytes(randomBytes(ENROLLMENT_CODE_BYTES))
      const { lookupHash, codeHash } = enrollmentCodeDigests(code, enrollmentPepper())
      try {
        await db.transaction(async (trx) => {
          // A dead code (expired or out of attempts) no longer holds its lookup part.
          await trx
            .from(ENROLLMENT_CODES_TABLE)
            .where('lookup_hash', lookupHash)
            .whereNull('used_at')
            .where((dead) =>
              dead
                .where('expires_at', '<=', now.toJSDate())
                .orWhere('attempts', '>=', ENROLLMENT_CODE_MAX_ATTEMPTS)
            )
            .delete()
          await trx.table(ENROLLMENT_CODES_TABLE).insert({
            user_id: user.id,
            lookup_hash: lookupHash,
            code_hash: codeHash,
            expires_at: expiresAt.toJSDate(),
            attempts: 0,
            created_at: now.toJSDate(),
          })
        })
        return { code, expiresAt }
      } catch (error) {
        // Another pending code has these first characters: draw again.
        if ((error as { code?: unknown }).code !== UNIQUE_VIOLATION) throw error
      }
    }
    throw new Error('Could not draw a free enrolment code')
  }
}
