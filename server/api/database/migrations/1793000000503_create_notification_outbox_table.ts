// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Notifications waiting to be published (ntfy). Written in the same
 * transaction as the change they announce, so a notice is never lost nor
 * sent for a change that rolled back; the ntfy notifier (S6) publishes
 * the rows with `sent_at IS NULL` by `next_attempt_at`, with backoff.
 *
 * - `topic` is where the row goes (a capability: never logged). Rotating
 *   a link's topic moves its unsent rows to the new one.
 * - `payload` holds reason codes and ids only (app/domain/guardians/
 *   guardian_notice.ts); the notifier writes the text in the recipient's
 *   language.
 * - `dedupe_key` is unique: a retried request or job queues a notice once.
 */
export default class extends BaseSchema {
  protected tableName = 'notification_outbox'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table
        .integer('recipient_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('channel', 16).notNullable().defaultTo('ntfy')
      table.string('topic', 64).notNullable()
      table.jsonb('payload').notNullable()
      table.string('dedupe_key', 160).notNullable().unique()
      table.smallint('attempts').notNullable().defaultTo(0)
      table.timestamp('next_attempt_at', { useTz: true }).notNullable()
      table.timestamp('sent_at', { useTz: true }).nullable()
      table.string('last_error', 500).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.index(['recipient_user_id'])
    })
    this.schema.raw(
      `ALTER TABLE ${this.tableName}
         ADD CONSTRAINT notification_outbox_channel_check CHECK (channel IN ('ntfy')),
         ADD CONSTRAINT notification_outbox_topic_check CHECK (topic ~ '^[A-Za-z0-9_-]{1,64}$')`
    )
    this.schema.raw(
      `CREATE INDEX notification_outbox_due
         ON ${this.tableName} (next_attempt_at) WHERE sent_at IS NULL`
    )
    this.schema.raw(
      `CREATE INDEX notification_outbox_unsent_topic
         ON ${this.tableName} (topic) WHERE sent_at IS NULL`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
