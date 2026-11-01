// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The ntfy outbox dispatcher (app/services/notify/outbox_dispatcher.ts)
 * gives up on a row after its fourth failed attempt: `gave_up_at` marks
 * it, with the reason in `last_error`, and the due index skips it.
 */
export default class extends BaseSchema {
  protected tableName = 'notification_outbox'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('gave_up_at', { useTz: true }).nullable()
    })
    this.schema.raw(
      `CREATE INDEX notification_outbox_dispatchable
         ON ${this.tableName} (next_attempt_at) WHERE sent_at IS NULL AND gave_up_at IS NULL`
    )
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS notification_outbox_dispatchable')
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('gave_up_at')
    })
  }
}
