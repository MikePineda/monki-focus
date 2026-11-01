// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `unlock_tokens.request_uuid` predates `unlock_requests` (see its
 * migration): a ledger row now names its request and goes with it.
 * `consumed_at` is the device's optional "used" telemetry
 * (`POST /device/unlock-tokens/:jti/consumed`).
 */
export default class extends BaseSchema {
  protected tableName = 'unlock_tokens'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .foreign('request_uuid', 'unlock_tokens_request_uuid_foreign')
        .references('uuid')
        .inTable('unlock_requests')
        .onDelete('CASCADE')
      table.timestamp('consumed_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['request_uuid'], 'unlock_tokens_request_uuid_foreign')
      table.dropColumn('consumed_at')
    })
  }
}
