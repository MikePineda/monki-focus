// SPDX-License-Identifier: AGPL-3.0-or-later
import { generateKeyPairSync } from 'node:crypto'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import encryption from '@adonisjs/core/services/encryption'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import type { KeyPurpose } from '@monki-focus/protocol'
import { parseEnvSigningKey } from '#domain/keys/env_signing_key'
import { activeKeyOf, prunableKeys } from '#domain/keys/key_ring'
import { planKeyRotation } from '#domain/keys/key_rotation'
import {
  checkStoredKey,
  exportPkcs8,
  signingKeyFromPkcs8,
  signingKeyFromSecret,
  type SigningKeyMaterial,
} from '#domain/keys/signing_key_material'
import {
  isKeyPurpose,
  SIGNING_KEY_ALGORITHM,
  SIGNING_KEY_PURPOSES,
  type SigningKeyRecord,
} from '#domain/keys/signing_key_record'
import type { TokenIssuerIdentity } from '#services/token_issuer_identity'
import { encodeBase64Url } from '@monki-focus/protocol'

export const SIGNING_KEYS_TABLE = 'signing_keys'

/** Serialises key creation, rotation and pruning across processes and replicas. */
const ADVISORY_LOCK = 'monki-focus:signing-keys'

/**
 * Why a key operation failed. Messages name kids and settings, never key
 * material; commands print them, the boot fails with them.
 */
export class SigningKeyError extends Error {
  constructor(
    readonly reason: string,
    message: string
  ) {
    super(message)
    this.name = 'SigningKeyError'
  }
}

interface SigningKeyRow {
  kid: string
  purpose: string
  algorithm: string
  public_key: string
  private_key_encrypted: string | null
  status: string
  endorsement: string | null
  created_at: Date
  retired_at: Date | null
}

export interface RotationOptions {
  /** `env`: the successor is UNLOCK_SIGNING_KEY (unlock only); `generate`: a fresh key. */
  readonly successor: 'generate' | 'env'
  /** False only to recover from a lost or compromised key: devices must enrol again. */
  readonly endorse: boolean
}

export interface RotationResult {
  readonly kid: string
  readonly retiredKid: string | null
  readonly endorsed: boolean
}

const toSeconds = (date: Date) => Math.floor(date.getTime() / 1000)
const toDate = (seconds: number) => new Date(seconds * 1000)

/** Encryption purpose of a private key: the ciphertext only decrypts as this kid's key. */
const encryptionPurpose = (purpose: KeyPurpose, kid: string) => `signing-key:${purpose}:${kid}`

/**
 * The `signing_keys` table and the private keys behind it. Private keys are
 * decrypted only to sign (and kept in memory per kid), checked strictly
 * against their stored public key on every load, and never logged or
 * returned outside a `SigningKeyMaterial`.
 *
 * Precedence of the unlock key: when UNLOCK_SIGNING_KEY (and its kid) is
 * set, that key is the unlock key. At first boot its public half is stored
 * as the active unlock key and its private half never touches the
 * database; at any later boot the active unlock key must be that key,
 * otherwise the server refuses to start (switching keys silently would
 * strand every enrolled device). Without it, the server generates the key
 * and stores it encrypted with APP_KEY. The policy key is always generated.
 */
export default class SigningKeyStore {
  readonly #envKey: SigningKeyMaterial | null
  readonly #loaded = new Map<string, SigningKeyMaterial>()

  constructor(options: { envKey?: SigningKeyMaterial | null } = {}) {
    this.#envKey = options.envKey ?? null
  }

  /** The store with UNLOCK_SIGNING_KEY / UNLOCK_SIGNING_KEY_ID (validated at boot by start/env.ts). */
  static fromEnvironment(): SigningKeyStore {
    const parsed = parseEnvSigningKey({
      key: env.get('UNLOCK_SIGNING_KEY')?.release(),
      kid: env.get('UNLOCK_SIGNING_KEY_ID'),
    })
    if (!parsed.ok) {
      throw new SigningKeyError(parsed.reason, `UNLOCK_SIGNING_KEY is invalid (${parsed.reason})`)
    }
    return new SigningKeyStore({ envKey: parsed.value })
  }

  /** Every key, strictly checked; no private material. */
  async records(client: QueryClientContract = db.connection()): Promise<SigningKeyRecord[]> {
    const rows = await client.from(SIGNING_KEYS_TABLE).select('*').orderBy('id')
    return (rows as SigningKeyRow[]).map((row) => this.#toRecord(row))
  }

  /**
   * Boot: makes sure every purpose has an active key (generating one, or
   * adopting UNLOCK_SIGNING_KEY for the unlock purpose) and that every
   * active key loads, decrypts and matches. Answers the kids it created.
   */
  async ensureKeys(now: number): Promise<string[]> {
    return db.transaction(async (trx) => {
      await this.#lock(trx)
      const records = await this.records(trx)
      const created: string[] = []
      for (const purpose of SIGNING_KEY_PURPOSES) {
        const active = activeKeyOf(records, purpose)
        const envKey = purpose === 'unlock' ? this.#envKey : null
        if (envKey !== null && active !== undefined && active.kid !== envKey.kid) {
          throw new SigningKeyError(
            'env_key_not_active',
            `UNLOCK_SIGNING_KEY (kid ${envKey.kid}) is not the active unlock key (kid ${active.kid}). ` +
              'Run `node ace signing-key:rotate --purpose=unlock --from-env` to switch to it with an ' +
              'endorsement, or unset UNLOCK_SIGNING_KEY and UNLOCK_SIGNING_KEY_ID.'
          )
        }
        if (active !== undefined) continue
        const material = envKey ?? this.#generate(purpose)
        await this.#insert(trx, material, now, null, envKey === null)
        created.push(material.kid)
      }
      for (const purpose of SIGNING_KEY_PURPOSES) {
        await this.#activeMaterial(trx, purpose)
      }
      return created
    })
  }

  /** The active key of a purpose, ready to sign. Retired keys never sign. */
  async signingKey(purpose: KeyPurpose): Promise<SigningKeyMaterial> {
    return this.#activeMaterial(db.connection(), purpose)
  }

  /**
   * Rotates one purpose: the active key retires (its private key erased)
   * and endorses the successor, which becomes active. Refused while a
   * retired key of the purpose is still published.
   */
  async rotate(
    purpose: KeyPurpose,
    now: number,
    identity: TokenIssuerIdentity,
    options: RotationOptions
  ): Promise<RotationResult> {
    return db.transaction(async (trx) => {
      await this.#lock(trx)
      const records = await this.records(trx)
      const successor = this.#successor(purpose, options)
      const active = activeKeyOf(records, purpose)
      const endorser =
        options.endorse && active !== undefined ? await this.#activeMaterial(trx, purpose) : null

      const plan = planKeyRotation({
        purpose,
        records,
        successor,
        endorser,
        issuer: identity.issuer,
        profile: identity.profile,
        now,
      })
      if (!plan.ok) throw new SigningKeyError(plan.reason, rotationRefusal(plan.reason, purpose))

      if (plan.value.retireKid !== null) {
        await trx
          .from(SIGNING_KEYS_TABLE)
          .where({ kid: plan.value.retireKid, status: 'active' })
          .update({ status: 'retired', retired_at: toDate(now), private_key_encrypted: null })
        this.#loaded.delete(plan.value.retireKid)
      }
      await this.#insert(
        trx,
        successor,
        now,
        plan.value.endorsement,
        successor.kid !== this.#envKey?.kid
      )
      return {
        kid: successor.kid,
        retiredKid: plan.value.retireKid,
        endorsed: plan.value.endorsement !== null,
      }
    })
  }

  /**
   * Deletes retired keys whose grace has passed (every token they signed
   * has expired, plus a day); `force` deletes every retired key. Never an
   * active one. Answers the pruned kids.
   */
  async prune(now: number, options: { force?: boolean } = {}): Promise<string[]> {
    return db.transaction(async (trx) => {
      await this.#lock(trx)
      const kids = prunableKeys(await this.records(trx), now, options).map((record) => record.kid)
      if (kids.length > 0) {
        await trx.from(SIGNING_KEYS_TABLE).whereIn('kid', kids).where('status', 'retired').delete()
      }
      return kids
    })
  }

  async #lock(trx: QueryClientContract) {
    await trx.rawQuery('SELECT pg_advisory_xact_lock(hashtext(?))', [ADVISORY_LOCK])
  }

  #generate(purpose: KeyPurpose): SigningKeyMaterial {
    const material = signingKeyFromSecret(purpose, generateKeyPairSync('ed25519').privateKey)
    if (!material.ok) throw new SigningKeyError(material.reason, 'generated key refused')
    return material.value
  }

  #successor(purpose: KeyPurpose, options: RotationOptions): SigningKeyMaterial {
    if (options.successor === 'generate') return this.#generate(purpose)
    if (purpose !== 'unlock' || this.#envKey === null) {
      throw new SigningKeyError(
        'env_key_unavailable',
        '--from-env needs --purpose=unlock and UNLOCK_SIGNING_KEY with UNLOCK_SIGNING_KEY_ID'
      )
    }
    return this.#envKey
  }

  async #insert(
    trx: QueryClientContract,
    material: SigningKeyMaterial,
    now: number,
    endorsement: string | null,
    storePrivateKey: boolean
  ) {
    await trx.table(SIGNING_KEYS_TABLE).insert({
      kid: material.kid,
      purpose: material.purpose,
      algorithm: SIGNING_KEY_ALGORITHM,
      public_key: encodeBase64Url(material.publicKey),
      private_key_encrypted: storePrivateKey
        ? encryption.encrypt(exportPkcs8(material), {
            purpose: encryptionPurpose(material.purpose, material.kid),
          })
        : null,
      status: 'active',
      endorsement,
      created_at: toDate(now),
      retired_at: null,
    })
  }

  async #activeMaterial(
    client: QueryClientContract,
    purpose: KeyPurpose
  ): Promise<SigningKeyMaterial> {
    const row = (await client
      .from(SIGNING_KEYS_TABLE)
      .where({ purpose, status: 'active' })
      .first()) as SigningKeyRow | null
    if (row === null) {
      throw new SigningKeyError('no_active_key', `no active ${purpose} signing key`)
    }
    const record = this.#toRecord(row)
    const cached = this.#loaded.get(record.kid)
    if (cached !== undefined) return cached

    const material = this.#privateMaterial(record, row.private_key_encrypted)
    const checked = checkStoredKey(record, material)
    if (!checked.ok) {
      throw new SigningKeyError(checked.reason, `signing key ${record.kid} does not match its row`)
    }
    this.#loaded.set(record.kid, material)
    return material
  }

  #privateMaterial(record: SigningKeyRecord, encrypted: string | null): SigningKeyMaterial {
    if (encrypted === null) {
      if (this.#envKey !== null && this.#envKey.kid === record.kid) return this.#envKey
      throw new SigningKeyError(
        'private_key_missing',
        `the private key of ${record.purpose} key ${record.kid} is not in the database; ` +
          'set UNLOCK_SIGNING_KEY and UNLOCK_SIGNING_KEY_ID to it'
      )
    }
    const pkcs8 = encryption.decrypt<string>(
      encrypted,
      encryptionPurpose(record.purpose, record.kid)
    )
    if (typeof pkcs8 !== 'string') {
      throw new SigningKeyError(
        'undecryptable',
        `signing key ${record.kid} cannot be decrypted with APP_KEY (was APP_KEY changed? ` +
          'see docs/RUNBOOK.md, "Signing keys")'
      )
    }
    const material = signingKeyFromPkcs8(record.purpose, pkcs8)
    if (!material.ok) {
      throw new SigningKeyError(material.reason, `signing key ${record.kid} is not a valid key`)
    }
    return material.value
  }

  #toRecord(row: SigningKeyRow): SigningKeyRecord {
    if (
      !isKeyPurpose(row.purpose) ||
      row.algorithm !== SIGNING_KEY_ALGORITHM ||
      (row.status !== 'active' && row.status !== 'retired')
    ) {
      throw new SigningKeyError('corrupt_row', `signing key ${row.kid} has an invalid row`)
    }
    const record: SigningKeyRecord = {
      kid: row.kid,
      purpose: row.purpose,
      publicKey: row.public_key,
      status: row.status,
      createdAt: toSeconds(row.created_at),
      retiredAt: row.retired_at === null ? null : toSeconds(row.retired_at),
      endorsement: row.endorsement,
    }
    const checked = checkStoredKey(record)
    if (!checked.ok) {
      throw new SigningKeyError(
        checked.reason,
        `signing key ${row.kid} fails the strict key checks`
      )
    }
    return record
  }
}

function rotationRefusal(reason: string, purpose: KeyPurpose): string {
  switch (reason) {
    case 'retired_key_pending':
      return `a retired ${purpose} key is still published; run \`node ace signing-key:prune\` first (or --force once no token it signed can still be in use)`
    case 'successor_already_known':
      return `the new ${purpose} key is already a key of this instance`
    default:
      return `the ${purpose} key rotation was refused (${reason})`
  }
}
