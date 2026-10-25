// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Append-only log of everything that weakened protection, for the user and
 * (later) the guardian: reported by a device (`source = 'client'`) or
 * raised by the server (`'server'`: dead-man switch, key pin mismatch,
 * enrolment, revocation). `kind` is a reason code
 * (app/domain/devices/bypass_event_kinds.ts) and `details` small codes and
 * numbers only, never a URL, a title or screen text.
 *
 * Idempotent per user by `dedupe_key`, namespaced by source
 * (app/domain/devices/bypass_dedupe_key.ts), so a device can never claim a
 * key the server will use and silence an alert. `notified_at` is for the
 * notification outbox (S6); `resolved_at` closes a dead-man gap.
 */
export default class extends BaseSchema {
  protected tableName = 'bypass_events'

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
      table
        .integer('device_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('devices')
        .onDelete('SET NULL')
      table.string('kind', 48).notNullable()
      table.string('source', 8).notNullable()
      table.string('dedupe_key', 160).notNullable()
      table.timestamp('occurred_at', { useTz: true }).notNullable()
      table.timestamp('resolved_at', { useTz: true }).nullable()
      table.jsonb('details').notNullable().defaultTo('{}')
      table.timestamp('notified_at', { useTz: true }).nullable()
      table.timestamp('acknowledged_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.unique(['ward_user_id', 'dedupe_key'])
    })
    this.schema.raw(
      `ALTER TABLE ${this.tableName}
         ADD CONSTRAINT bypass_events_source_check CHECK (source IN ('client', 'server')),
         ADD CONSTRAINT bypass_events_kind_check CHECK (kind ~ '^[a-z][a-z0-9_]{0,47}$')`
    )
    this.schema.raw(
      `CREATE INDEX bypass_events_ward_occurred
         ON ${this.tableName} (ward_user_id, occurred_at DESC)`
    )
    this.schema.raw(
      `CREATE INDEX bypass_events_open_by_device ON ${this.tableName} (device_id, kind)
         WHERE resolved_at IS NULL`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
