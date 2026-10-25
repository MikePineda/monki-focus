// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `unlock_tokens.device_uuid` predates `devices` (see its migration): a
 * ledger row now names an enrolled device and goes with it. Devices are
 * revoked, not deleted, so revoking keeps the ledger (and its pending
 * revocations); only deleting the account removes it.
 */
export default class extends BaseSchema {
  protected tableName = 'unlock_tokens'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .foreign('device_uuid', 'unlock_tokens_device_uuid_foreign')
        .references('uuid')
        .inTable('devices')
        .onDelete('CASCADE')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['device_uuid'], 'unlock_tokens_device_uuid_foreign')
    })
  }
}
