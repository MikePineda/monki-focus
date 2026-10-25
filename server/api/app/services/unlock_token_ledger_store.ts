// SPDX-License-Identifier: AGPL-3.0-or-later
import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { CLOCK_SKEW_SECONDS } from '@monki-focus/protocol'
import { refuse, succeed, type Outcome } from '#domain/outcome'
import {
  pendingRevocations,
  revokeUnlockToken,
  type RevocationFailure,
  type UnlockLedgerEntry,
  type UnlockRevocation,
} from '#domain/unlock/unlock_token_ledger'

export const UNLOCK_TOKENS_TABLE = 'unlock_tokens'

interface UnlockTokenRow {
  jti: string
  request_uuid: string
  device_uuid: string
  kid: string
  token_hash: string
  issued_at: Date
  not_before: Date
  expires_at: Date
  revoked_at: Date | null
}

const toSeconds = (date: Date) => Math.floor(date.getTime() / 1000)
const toDate = (seconds: number) => new Date(seconds * 1000)

function toEntry(row: UnlockTokenRow): UnlockLedgerEntry {
  return {
    jti: row.jti,
    requestUuid: row.request_uuid,
    deviceUuid: row.device_uuid,
    kid: row.kid,
    tokenHash: row.token_hash,
    issuedAt: toSeconds(row.issued_at),
    notBefore: toSeconds(row.not_before),
    expiresAt: toSeconds(row.expires_at),
    revokedAt: row.revoked_at === null ? null : toSeconds(row.revoked_at),
  }
}

/** `unlock_tokens`: the issued-token ledger (hashes only, never tokens). */
export default class UnlockTokenLedgerStore {
  async record(entry: UnlockLedgerEntry, client: QueryClientContract = db.connection()) {
    await client.table(UNLOCK_TOKENS_TABLE).insert({
      jti: entry.jti,
      request_uuid: entry.requestUuid,
      device_uuid: entry.deviceUuid,
      kid: entry.kid,
      token_hash: entry.tokenHash,
      issued_at: toDate(entry.issuedAt),
      not_before: toDate(entry.notBefore),
      expires_at: toDate(entry.expiresAt),
      revoked_at: entry.revokedAt === null ? null : toDate(entry.revokedAt),
    })
  }

  async find(jti: string): Promise<UnlockLedgerEntry | null> {
    const row = (await db.from(UNLOCK_TOKENS_TABLE).where({ jti }).first()) as UnlockTokenRow | null
    return row === null ? null : toEntry(row)
  }

  /**
   * Revokes one issued token at `now` (row locked, so two revocations never
   * race). The caller scopes `jti` to the acting user's devices.
   */
  async revoke(
    jti: string,
    now: number
  ): Promise<Outcome<UnlockLedgerEntry, RevocationFailure | 'unknown_token'>> {
    return db.transaction(async (trx) => {
      const row = (await trx
        .from(UNLOCK_TOKENS_TABLE)
        .where({ jti })
        .forUpdate()
        .first()) as UnlockTokenRow | null
      if (row === null) return refuse('unknown_token')
      const revoked = revokeUnlockToken(toEntry(row), now)
      if (!revoked.ok) return revoked
      await trx
        .from(UNLOCK_TOKENS_TABLE)
        .where({ jti })
        .update({ revoked_at: toDate(now) })
      return succeed(revoked.value)
    })
  }

  /** Revoked tokens of a device that are still usable at `now`: what its time tokens list. */
  async pendingRevocationsFor(deviceUuid: string, now: number): Promise<UnlockRevocation[]> {
    const rows = (await db
      .from(UNLOCK_TOKENS_TABLE)
      .where({ device_uuid: deviceUuid })
      .whereNotNull('revoked_at')
      .where('expires_at', '>=', toDate(now - CLOCK_SKEW_SECONDS))) as UnlockTokenRow[]
    return pendingRevocations(rows.map(toEntry), now)
  }
}
