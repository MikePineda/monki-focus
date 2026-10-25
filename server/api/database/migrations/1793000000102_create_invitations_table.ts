// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Admin invitations: the only way in while REGISTRATION_OPEN is off (besides
 * a guardian pairing code, later). The link carries a 256-bit random token;
 * only its SHA-256 (hex) is stored. Valid 7 days, single use: `used_at` and
 * `used_by_user_id` are set in the same transaction that creates the
 * account. `email`, when set, is the only address that may accept it.
 */
export default class extends BaseSchema {
  protected tableName = 'invitations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('created_by_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.specificType('token_hash', 'char(64)').notNullable().unique()
      table.specificType('email', 'citext').nullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('used_at', { useTz: true }).nullable()
      table
        .integer('used_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['created_by_user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
