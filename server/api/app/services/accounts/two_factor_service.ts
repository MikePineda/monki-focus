// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomBytes } from 'node:crypto'
import type { DateTime } from 'luxon'
import env from '#start/env'
import type User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import RecoveryCode from '#models/recovery_code'
import { CodedError } from '#exceptions/coded_error'
import encryption from '@adonisjs/core/services/encryption'
import { revokeSessions } from '#services/accounts/session_revocation'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { otpauthUri } from '#domain/auth/otpauth_uri'
import { base32Decode, base32Encode } from '#domain/auth/base32'
import { matchTotpStep } from '#domain/auth/totp'
import { oneWayDigest } from '#domain/accounts/one_way_digest'
import {
  formatRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_CODE_BYTES,
  RECOVERY_CODE_COUNT,
} from '#domain/auth/recovery_code'

/** Encryption purpose of stored TOTP seeds: a value encrypted for anything else never decrypts as one. */
const SEED_PURPOSE = 'totp-seed'

/** 160-bit seeds, the RFC 4226 recommendation. */
const SEED_BYTES = 20

export interface SecondFactor {
  code?: string
  recoveryCode?: string
}

/**
 * TOTP two-factor authentication, optional per user (the guardian package
 * makes it mandatory for guardians). The seed is stored encrypted with
 * APP_KEY (AES-256-GCM); recovery codes only as SHA-256. Codes are matched
 * within ±1 step and each step, like each recovery code, works once: both
 * are consumed with a conditional UPDATE, so two concurrent requests with
 * the same code cannot both pass.
 */
export default class TwoFactorService {
  /**
   * Starts (or restarts) an enrolment: a fresh seed, stored but not yet
   * active until `confirm`. Refused while TOTP is on.
   */
  async begin(user: User) {
    if (user.twoFactorEnabled) {
      throw new CodedError('E_TWO_FACTOR_ALREADY_ENABLED', 409, 'Two-factor is already on')
    }
    const seed = base32Encode(randomBytes(SEED_BYTES))
    user.totpSecretEncrypted = encryption.encrypt(seed, undefined, SEED_PURPOSE)
    user.totpLastUsedStep = null
    await user.save()

    return {
      secret: seed,
      otpauthUrl: otpauthUri({
        issuer: env.get('APP_NAME') || 'monki-focus',
        account: user.email,
        secret: seed,
      }),
    }
  }

  /**
   * Activates TOTP with the first code from the new seed and returns the
   * recovery codes (shown once). Bumps session_version: sessions opened
   * before the second factor existed end (the caller keeps its own).
   */
  async confirm(user: User, code: string, now: DateTime): Promise<string[]> {
    if (user.twoFactorEnabled || !user.totpSecretEncrypted) {
      throw new CodedError('E_TWO_FACTOR_NOT_PENDING', 409, 'No two-factor enrolment to confirm')
    }
    await this.consumeCode(user, code, now)

    return db.transaction(async (trx) => {
      user.useTransaction(trx)
      user.totpEnabledAt = now
      await user.save()
      await revokeSessions(user, trx)
      return this.issueRecoveryCodes(user, now, trx)
    })
  }

  /**
   * Checks a second factor (an authenticator code or one recovery code) and
   * consumes it. Throws 400 `E_INVALID_TWO_FACTOR_CODE` otherwise, which the
   * callers' throttles count.
   */
  async verify(user: User, factor: SecondFactor, now: DateTime): Promise<void> {
    if (!user.twoFactorEnabled) {
      throw new CodedError('E_TWO_FACTOR_NOT_ENABLED', 409, 'Two-factor is off')
    }
    if (factor.code) return this.consumeCode(user, factor.code, now)
    if (factor.recoveryCode) return this.consumeRecoveryCode(user, factor.recoveryCode, now)
    throw invalidCode()
  }

  /** Turns TOTP off: seed, steps and recovery codes are gone. */
  async disable(user: User): Promise<void> {
    await db.transaction(async (trx) => {
      await RecoveryCode.query({ client: trx }).where('user_id', user.id).delete()
      user.useTransaction(trx)
      user.totpSecretEncrypted = null
      user.totpEnabledAt = null
      user.totpLastUsedStep = null
      await user.save()
    })
  }

  /** A new set of recovery codes; the old ones stop working. */
  async regenerateRecoveryCodes(user: User, now: DateTime): Promise<string[]> {
    if (!user.twoFactorEnabled) {
      throw new CodedError('E_TWO_FACTOR_NOT_ENABLED', 409, 'Two-factor is off')
    }
    return db.transaction((trx) => this.issueRecoveryCodes(user, now, trx))
  }

  /** Recovery codes still unused (the export and the settings page show the count). */
  async remainingRecoveryCodes(user: User): Promise<number> {
    const result = await RecoveryCode.query()
      .where('user_id', user.id)
      .whereNull('used_at')
      .count('* as total')
    return Number(result[0].$extras.total)
  }

  protected seedOf(user: User): Buffer {
    const stored = user.totpSecretEncrypted
    const seed = stored ? encryption.decrypt<string>(stored, SEED_PURPOSE) : null
    const bytes = typeof seed === 'string' ? base32Decode(seed) : null
    // A seed that no longer decrypts (APP_KEY rotated) fails closed.
    if (!bytes) throw invalidCode()
    return bytes
  }

  protected async consumeCode(user: User, code: string, now: DateTime) {
    const step = matchTotpStep(this.seedOf(user), code, now.toSeconds(), user.totpLastUsedStep)
    if (step === null) throw invalidCode()

    const claimed = await db.rawQuery<{ rows: unknown[] }>(
      `UPDATE users SET totp_last_used_step = ?, updated_at = ?
        WHERE id = ? AND (totp_last_used_step IS NULL OR totp_last_used_step < ?)
        RETURNING id`,
      [step, now.toJSDate(), user.id, step]
    )
    if (claimed.rows.length === 0) throw invalidCode()
    user.totpLastUsedStep = step
  }

  protected async consumeRecoveryCode(user: User, typed: string, now: DateTime) {
    const normalized = normalizeRecoveryCode(typed)
    if (!normalized) throw invalidCode()

    const claimed = await db.rawQuery<{ rows: unknown[] }>(
      `UPDATE user_recovery_codes SET used_at = ?
        WHERE user_id = ? AND code_hash = ? AND used_at IS NULL
        RETURNING id`,
      [now.toJSDate(), user.id, oneWayDigest(normalized)]
    )
    if (claimed.rows.length === 0) throw invalidCode()
  }

  protected async issueRecoveryCodes(
    user: User,
    now: DateTime,
    trx: TransactionClientContract
  ): Promise<string[]> {
    await RecoveryCode.query({ client: trx }).where('user_id', user.id).delete()
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      formatRecoveryCode(randomBytes(RECOVERY_CODE_BYTES))
    )
    await RecoveryCode.createMany(
      codes.map((code) => ({
        userId: user.id,
        codeHash: oneWayDigest(normalizeRecoveryCode(code)!),
        createdAt: now,
      })),
      { client: trx }
    )
    return codes
  }
}

function invalidCode() {
  return new CodedError('E_INVALID_TWO_FACTOR_CODE', 400, 'The code is not valid')
}
