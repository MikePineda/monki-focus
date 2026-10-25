// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Ed25519 signing keys of this instance (docs/protocol/unlock-tokens.md §2),
 * one row per key:
 *
 * - `purpose`: `unlock` (unlock and time tokens) or `policy` (policy
 *   tokens); the two never share a key.
 * - `public_key`: raw 32-byte key, unpadded base64url; `kid` is derived
 *   from it (checked strictly every time a row is loaded).
 * - `private_key_encrypted`: PKCS#8 DER encrypted with APP_KEY (AES-256-GCM,
 *   bound to the kid), never in clear. NULL for a key supplied through
 *   UNLOCK_SIGNING_KEY (it lives in the environment only) and for every
 *   retired key (erased on retirement: a retired key never signs again).
 * - `status`: `active` signs; `retired` is still published and verifies
 *   until `node ace signing-key:prune` removes it.
 * - `endorsement`: the key endorsement token signed by the previous active
 *   key of the purpose (NULL for a first key or an unendorsed recovery).
 *
 * At most one active key per purpose (partial unique index). Plain strings
 * with CHECK constraints instead of native enums.
 */
export default class extends BaseSchema {
  protected tableName = 'signing_keys'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('kid', 32).notNullable().unique()
      table.string('purpose', 16).notNullable()
      table.string('algorithm', 16).notNullable().defaultTo('EdDSA')
      table.text('public_key').notNullable()
      table.text('private_key_encrypted').nullable()
      table.string('status', 16).notNullable()
      table.text('endorsement').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('retired_at', { useTz: true }).nullable()
    })
    this.schema.raw(
      `ALTER TABLE ${this.tableName}
         ADD CONSTRAINT signing_keys_purpose_check CHECK (purpose IN ('unlock', 'policy')),
         ADD CONSTRAINT signing_keys_algorithm_check CHECK (algorithm = 'EdDSA'),
         ADD CONSTRAINT signing_keys_status_check CHECK (status IN ('active', 'retired')),
         ADD CONSTRAINT signing_keys_retired_at_check
           CHECK ((status = 'retired') = (retired_at IS NOT NULL)),
         ADD CONSTRAINT signing_keys_retired_private_key_erased_check
           CHECK (status = 'active' OR private_key_encrypted IS NULL)`
    )
    this.schema.raw(
      `CREATE UNIQUE INDEX signing_keys_one_active_per_purpose
         ON ${this.tableName} (purpose) WHERE status = 'active'`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
