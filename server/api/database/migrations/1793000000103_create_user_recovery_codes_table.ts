// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Two-factor recovery codes: ten per user, shown once when TOTP is
 * confirmed (or regenerated), stored only as SHA-256 (hex). Each works
 * once (`used_at`).
 */
export default class extends BaseSchema {
  protected tableName = 'user_recovery_codes'

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
      table.specificType('code_hash', 'char(64)').notNullable()
      table.timestamp('used_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.unique(['user_id', 'code_hash'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
