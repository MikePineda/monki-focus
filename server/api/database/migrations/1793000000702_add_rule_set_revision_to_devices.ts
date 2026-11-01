// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The rule set revision a device last reported as applied (heartbeat
 * `ruleSetRevision`), on the device and on each heartbeat row. Null until
 * the device reports one (older clients never do). Additive only.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('devices', (table) => {
      table.integer('rule_set_revision').nullable()
    })
    this.schema.alterTable('device_heartbeats', (table) => {
      table.integer('rule_set_revision').nullable()
    })
  }

  async down() {
    this.schema.alterTable('device_heartbeats', (table) => {
      table.dropColumn('rule_set_revision')
    })
    this.schema.alterTable('devices', (table) => {
      table.dropColumn('rule_set_revision')
    })
  }
}
