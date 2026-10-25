// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One row per accepted heartbeat, kept HEARTBEAT_RETENTION_DAYS (30) and
 * pruned daily (app/services/devices/device_retention.ts). State codes
 * only: never the nonce, a token, a URL or a title.
 */
export default class extends BaseSchema {
  protected tableName = 'device_heartbeats'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table
        .integer('device_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('devices')
        .onDelete('CASCADE')
      table.timestamp('received_at', { useTz: true }).notNullable()
      table.timestamp('client_time', { useTz: true }).notNullable()
      table.boolean('protection_active').notNullable()
      table.string('rules_hash', 43).notNullable()
      table.string('policy_hash', 43).notNullable()
      table.string('client_version', 32).notNullable()
      table.string('boot', 64).notNullable()
      table.boolean('a11y_enabled').nullable()
      table.jsonb('risk_state').notNullable().defaultTo('[]')
      table.boolean('going_offline').notNullable().defaultTo(false)
      table.boolean('key_pin_mismatch').notNullable().defaultTo(false)
    })
    this.schema.raw(
      `CREATE INDEX device_heartbeats_device_received
         ON ${this.tableName} (device_id, received_at DESC)`
    )
    this.schema.raw(`CREATE INDEX device_heartbeats_received ON ${this.tableName} (received_at)`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
