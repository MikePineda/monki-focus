// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Guardian pairing codes (app/domain/guardians/pairing_code.ts): 6 digits,
 * PAIRING_CODE_TTL_MINUTES (10), single use. Never stored in clear:
 * `lookup_hash` is an HMAC (APP_KEY) of the first 3 digits, which find the
 * code, and `code_hash` an HMAC of all 6, which proves it. `attempts` is
 * raised atomically before a guess is compared; the code is dead at 5.
 * Among unused codes a lookup part is unique and a ward has one at most
 * (partial indexes). `guardian_link_id` names the link a used code made.
 */
export default class extends BaseSchema {
  protected tableName = 'pairing_codes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('ward_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.specificType('lookup_hash', 'char(64)').notNullable()
      table.specificType('code_hash', 'char(64)').notNullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.smallint('attempts').notNullable().defaultTo(0)
      table.timestamp('used_at', { useTz: true }).nullable()
      table
        .integer('used_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table
        .integer('guardian_link_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('guardian_links')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.index(['ward_user_id'])
    })
    this.schema.raw(
      `ALTER TABLE ${this.tableName}
         ADD CONSTRAINT pairing_codes_attempts_check CHECK (attempts BETWEEN 0 AND 5),
         ADD CONSTRAINT pairing_codes_hashes_check
           CHECK (lookup_hash ~ '^[0-9a-f]{64}$' AND code_hash ~ '^[0-9a-f]{64}$')`
    )
    this.schema.raw(
      `CREATE UNIQUE INDEX pairing_codes_pending_lookup
         ON ${this.tableName} (lookup_hash) WHERE used_at IS NULL`
    )
    this.schema.raw(
      `CREATE UNIQUE INDEX pairing_codes_pending_ward
         ON ${this.tableName} (ward_user_id) WHERE used_at IS NULL`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
