// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `scheduler_runs.user_id` predates `users` (see its migration): per-user
 * runs now cascade with their user, so deleting an account leaves no row
 * that names it.
 */
export default class extends BaseSchema {
  protected tableName = 'scheduler_runs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .foreign('user_id', 'scheduler_runs_user_id_foreign')
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['user_id'], 'scheduler_runs_user_id_foreign')
    })
  }
}
