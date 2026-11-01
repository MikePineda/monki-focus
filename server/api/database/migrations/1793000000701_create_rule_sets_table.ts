// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The user's current rule set (S15, app/services/rules/rule_set_store.ts):
 * one row per user, written only through `If-Match` on its `revision`.
 *
 * - `revision`: the server's monotonic counter (1, 2, 3...), the ETag of
 *   the rule set routes; revision 0 is "nothing stored" and has no row.
 * - `document`: the rule set as the user wrote it, validated against
 *   `packages/rules/schema/v1/ruleset.schema.json` (at most 256 KiB).
 *   It names domains and apps: never logged, never shown to a guardian.
 * - `content_hash`: unpadded base64url SHA-256 of the canonical JSON.
 * - `updated_by_device_id`: the device that wrote it, null for the web
 *   dashboard (or once that device row is gone).
 *
 * The user's row cascades (account deletion removes it).
 */
export default class extends BaseSchema {
  protected tableName = 'rule_sets'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.integer('revision').notNullable()
      table.jsonb('document').notNullable()
      table.string('content_hash', 43).notNullable()
      table
        .integer('updated_by_device_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('devices')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
    this.schema.raw(
      `ALTER TABLE ${this.tableName}
         ADD CONSTRAINT rule_sets_revision_check CHECK (revision >= 1),
         ADD CONSTRAINT rule_sets_content_hash_check CHECK (content_hash ~ '^[A-Za-z0-9_-]{43}$')`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
