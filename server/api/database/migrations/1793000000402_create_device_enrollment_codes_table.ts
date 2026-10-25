// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One-time enrolment codes (app/domain/devices/enrollment_code.ts): 8
 * base32 characters, 10 minutes. Never stored in clear: `lookup_hash` is an
 * HMAC (APP_KEY) of the first 3 characters, which find the code, and
 * `code_hash` an HMAC of all 8, which proves it. `attempts` counts the
 * guesses spent on this code: it is raised atomically before a guess is
 * checked and the code is dead at 5. Among codes not yet used a lookup part
 * is unique (partial index), so a guess always names at most one code.
 */
export default class extends BaseSchema {
  protected tableName = 'device_enrollment_codes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('user_id')
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
        .integer('device_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('devices')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.index(['user_id'])
    })
    this.schema.raw(
      `ALTER TABLE ${this.tableName}
         ADD CONSTRAINT device_enrollment_codes_attempts_check CHECK (attempts BETWEEN 0 AND 5),
         ADD CONSTRAINT device_enrollment_codes_hashes_check
           CHECK (lookup_hash ~ '^[0-9a-f]{64}$' AND code_hash ~ '^[0-9a-f]{64}$')`
    )
    this.schema.raw(
      `CREATE UNIQUE INDEX device_enrollment_codes_pending_lookup
         ON ${this.tableName} (lookup_hash) WHERE used_at IS NULL`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
