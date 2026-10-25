// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { CodedError } from '#exceptions/coded_error'
import { digestsMatch } from '#domain/accounts/one_way_digest'
import {
  PAIRING_CODE_MAX_ATTEMPTS,
  normalizePairingCode,
  pairingCodeDigests,
} from '#domain/guardians/pairing_code'

export const PAIRING_CODES_TABLE = 'pairing_codes'

/** The instance secret behind every pairing-code HMAC. */
export function pairingPepper(): string {
  return env.get('APP_KEY').release()
}

/** A pending code whose proof matched: whose it is. */
export interface ReservedPairingCode {
  readonly id: number
  readonly wardUserId: number
}

interface ReservedRow {
  id: number
  ward_user_id: number
  code_hash: string
}

/** Wrong, expired, used and locked codes all answer this same 400. */
export function invalidPairingCode() {
  return new CodedError('E_INVALID_PAIRING_CODE', 400, 'This pairing code is not valid')
}

/**
 * The guess side of a pairing code, shared by both ways of redeeming one
 * (a signed-in guardian, a new guardian account). The same design as
 * device enrolment (app/services/devices/device_enrollment.ts):
 *
 * 1. `reserve` charges the code's own counter first, with one atomic
 *    `UPDATE ... attempts + 1 ... WHERE attempts < 5 RETURNING`, so of any
 *    number of concurrent guesses at most 5 are ever compared and the fifth
 *    wrong one kills the code; only then is the full HMAC compared in
 *    constant time. Callers wrap it in the per-IP failure throttle.
 * 2. `lockForUse` (in the caller's transaction) locks the reserved row
 *    while it is still unused and unexpired, so two right guesses of one
 *    code cannot both create a link.
 * 3. `markUsed` consumes it, naming who used it and the link it made.
 */
export default class PairingCodeReservation {
  async reserve(typed: string, now: DateTime): Promise<ReservedPairingCode> {
    const code = normalizePairingCode(typed)
    if (code === null) throw invalidPairingCode()
    const { lookupHash, codeHash } = pairingCodeDigests(code, pairingPepper())

    const result = await db.rawQuery<{ rows: ReservedRow[] }>(
      `UPDATE ${PAIRING_CODES_TABLE} SET attempts = attempts + 1
        WHERE lookup_hash = ? AND used_at IS NULL AND expires_at > ? AND attempts < ?
        RETURNING id, ward_user_id, code_hash`,
      [lookupHash, now.toJSDate(), PAIRING_CODE_MAX_ATTEMPTS]
    )
    const row = result.rows[0]
    if (!row || !digestsMatch(row.code_hash, codeHash)) throw invalidPairingCode()
    return { id: row.id, wardUserId: row.ward_user_id }
  }

  async lockForUse(
    trx: TransactionClientContract,
    reserved: ReservedPairingCode,
    now: DateTime
  ): Promise<void> {
    const row = await trx
      .from(PAIRING_CODES_TABLE)
      .where('id', reserved.id)
      .whereNull('used_at')
      .where('expires_at', '>', now.toJSDate())
      .forUpdate()
      .first()
    // A concurrent request with the same right code won the race.
    if (!row) throw invalidPairingCode()
  }

  async markUsed(
    trx: TransactionClientContract,
    reserved: ReservedPairingCode,
    usedBy: { userId: number; linkId: number },
    now: DateTime
  ): Promise<void> {
    await trx.from(PAIRING_CODES_TABLE).where('id', reserved.id).update({
      used_at: now.toJSDate(),
      used_by_user_id: usedBy.userId,
      guardian_link_id: usedBy.linkId,
    })
  }
}
