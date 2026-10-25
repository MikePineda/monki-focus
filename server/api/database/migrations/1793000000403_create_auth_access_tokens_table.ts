// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Device access tokens (`@adonisjs/auth` access tokens, `mfd_` prefix):
 * the standard table, with `tokenable_id` pointing at **devices**, not
 * users. Only the SHA-256 of the secret is stored (`hash`); the token is
 * returned once, at enrolment or rotation. No expiry by default; a rotated
 * token keeps a short grace (`expires_at`).
 */
export default class extends BaseSchema {
  protected tableName = 'auth_access_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('tokenable_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('devices')
        .onDelete('CASCADE')
      table.string('type').notNullable()
      table.string('name').nullable()
      table.string('hash').notNullable()
      table.text('abilities').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.timestamp('last_used_at', { useTz: true }).nullable()
      table.timestamp('expires_at', { useTz: true }).nullable()

      table.index(['tokenable_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
