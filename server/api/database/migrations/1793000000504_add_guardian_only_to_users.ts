// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `users.guardian_only`: the account was created through a ward's pairing
 * code while registration was closed (app/domain/guardians/
 * guardian_only_policy.ts). Additive, with a constant default, so existing
 * rows (ordinary accounts) need no rewrite.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('guardian_only').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('guardian_only')
    })
  }
}
