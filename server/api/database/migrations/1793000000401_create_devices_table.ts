// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Enrolled devices (extension, Android, macOS): one row per enrolment,
 * owned by a user. `uuid` is the public id (the `dev` claim of every token
 * and the `:uuid` of the dashboard routes); `id` never leaves the server.
 *
 * Heartbeat state is denormalised here for the dashboard and the dead-man
 * switch: `last_seen_at`, `protection_active`, `a11y_enabled`,
 * `risk_state`, the reported `rules_hash` / `policy_hash`, the kids the
 * device pins (`pinned_kids`, compared with the instance's keys:
 * `key_pin_mismatch`) and the kids it was enrolled with (`enrolled_kids`).
 * Revoking sets `revoked_at` (the row stays for the guardian's history)
 * and deletes its access tokens. No native enums: `platform` is a plain
 * string checked against a list.
 */
export default class extends BaseSchema {
  protected tableName = 'devices'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('uuid').notNullable().unique()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('name', 64).notNullable()
      table.string('platform', 24).notNullable()
      table.string('client_version', 32).notNullable()
      table.string('rules_hash', 43).nullable()
      table.string('policy_hash', 43).nullable()
      table.boolean('protection_active').notNullable().defaultTo(false)
      table.boolean('a11y_enabled').nullable()
      table.jsonb('risk_state').notNullable().defaultTo('[]')
      table.jsonb('enrolled_kids').notNullable()
      table.jsonb('pinned_kids').nullable()
      table.boolean('key_pin_mismatch').notNullable().defaultTo(false)
      table.smallint('deadman_hours').notNullable().defaultTo(6)
      table.string('last_boot', 64).nullable()
      table.timestamp('last_seen_at', { useTz: true }).notNullable()
      table.timestamp('announced_offline_at', { useTz: true }).nullable()
      table.integer('clock_offset_ms').nullable()
      table.timestamp('revoked_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['user_id'])
    })
    this.schema.raw(
      `ALTER TABLE ${this.tableName}
         ADD CONSTRAINT devices_platform_check
           CHECK (platform IN ('chrome_extension', 'android', 'macos', 'other')),
         ADD CONSTRAINT devices_deadman_hours_check CHECK (deadman_hours BETWEEN 1 AND 48)`
    )
    // The dead-man switch scans only devices that can go quiet.
    this.schema.raw(
      `CREATE INDEX devices_deadman_scan ON ${this.tableName} (last_seen_at)
         WHERE revoked_at IS NULL AND protection_active`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
