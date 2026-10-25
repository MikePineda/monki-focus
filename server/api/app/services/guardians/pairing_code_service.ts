// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomInt } from 'node:crypto'
import type { DateTime } from 'luxon'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'
import { assertMayStartOwnProtection } from '#services/guardians/guardian_only_accounts'
import {
  PAIRING_CODE_MAX_ATTEMPTS,
  PAIRING_CODE_SPACE,
  pairingCodeDigests,
  pairingCodeFromInteger,
  pairingCodeTtlMinutes,
} from '#domain/guardians/pairing_code'
import { pairingQrPayload } from '#domain/guardians/pairing_qr_payload'
import { consumePairingCodeCreation } from '#services/guardians/guardian_throttles'
import { PAIRING_CODES_TABLE, pairingPepper } from '#services/guardians/pairing_code_reservation'

/** Fresh codes drawn before giving up on a lookup part that is taken. */
const MAX_DRAWS = 16

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = '23505'

export interface IssuedPairingCode {
  /** Shown once to the ward, never stored or logged in clear. */
  readonly code: string
  readonly expiresAt: DateTime
  /** What the QR code holds: `<APP_URL>/pair#<code>`, nothing personal. */
  readonly qrPayload: string
}

/**
 * The ward side of pairing: a signed-in user asks for a code to give the
 * person who will be their guardian. One pending code per ward (a new one
 * replaces the old; enforced by a unique index too), 10 per hour, valid
 * PAIRING_CODE_TTL_MINUTES (10). Requests are serialised on the ward's
 * row. The code is returned once and stored only as its two HMACs.
 */
export default class PairingCodeService {
  async create(ward: User, now: DateTime): Promise<IssuedPairingCode> {
    assertMayStartOwnProtection(ward)
    await consumePairingCodeCreation(ward.id)
    const expiresAt = now.plus({
      minutes: pairingCodeTtlMinutes(env.get('PAIRING_CODE_TTL_MINUTES')),
    })

    for (let draw = 0; draw < MAX_DRAWS; draw++) {
      const code = pairingCodeFromInteger(randomInt(0, PAIRING_CODE_SPACE))
      const { lookupHash, codeHash } = pairingCodeDigests(code, pairingPepper())
      try {
        await db.transaction(async (trx) => {
          // NO KEY UPDATE: a link inserted for this ward (FOR KEY SHARE) never waits on it.
          await trx.rawQuery('SELECT id FROM users WHERE id = ? FOR NO KEY UPDATE', [ward.id])
          await trx
            .from(PAIRING_CODES_TABLE)
            .where('ward_user_id', ward.id)
            .whereNull('used_at')
            .delete()
          // A dead code (expired or out of attempts) no longer holds its lookup part.
          await trx
            .from(PAIRING_CODES_TABLE)
            .where('lookup_hash', lookupHash)
            .whereNull('used_at')
            .where((dead) =>
              dead
                .where('expires_at', '<=', now.toJSDate())
                .orWhere('attempts', '>=', PAIRING_CODE_MAX_ATTEMPTS)
            )
            .delete()
          await trx.table(PAIRING_CODES_TABLE).insert({
            ward_user_id: ward.id,
            lookup_hash: lookupHash,
            code_hash: codeHash,
            expires_at: expiresAt.toJSDate(),
            attempts: 0,
            created_at: now.toJSDate(),
          })
        })
        return { code, expiresAt, qrPayload: pairingQrPayload(env.get('APP_URL'), code) }
      } catch (error) {
        // Another ward's pending code has these first digits: draw again.
        if ((error as { code?: unknown }).code !== UNIQUE_VIOLATION) throw error
      }
    }
    throw new Error('Could not draw a free pairing code')
  }
}
