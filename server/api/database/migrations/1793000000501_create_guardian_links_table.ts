// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Guardian links (app/domain/guardians/link_state.ts): a ward and the
 * trusted person who approves their unlocks and sees only aggregates.
 *
 * - `status` is `pending` (code redeemed, not confirmed by the ward yet),
 *   `active` or `revoked`; varchar with a check, not a native enum, so a
 *   later state is an additive change.
 * - `ntfy_topic` is the link's capability topic (128 random bits under
 *   NTFY_TOPIC_PREFIX), unique across links; told only to the guardian.
 * - A ward's request to leave sets `revocation_requested_at` and
 *   `revocation_effective_at` together; the link ends at the latter.
 *   `revoked_at` is set exactly when `status = 'revoked'`.
 * - A ward never guards themselves, and a pair has at most one live
 *   (pending or active) link; revoked links stay as history.
 * - Both users' rows cascade: deleting either account ends the link
 *   (the services tell the other side first).
 */
export default class extends BaseSchema {
  protected tableName = 'guardian_links'

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
        .integer('guardian_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('status', 16).notNullable().defaultTo('pending')
      table.string('ntfy_topic', 64).notNullable().unique()
      table.smallint('max_unlock_minutes').notNullable().defaultTo(30)
      table.boolean('allow_notification_actions').notNullable().defaultTo(true)
      table.timestamp('confirmed_at', { useTz: true }).nullable()
      table.timestamp('revocation_requested_at', { useTz: true }).nullable()
      table.timestamp('revocation_effective_at', { useTz: true }).nullable()
      table.timestamp('revoked_at', { useTz: true }).nullable()
      table
        .integer('revoked_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['guardian_user_id'])
      table.index(['ward_user_id'])
    })
    this.schema.raw(
      `ALTER TABLE ${this.tableName}
         ADD CONSTRAINT guardian_links_not_self CHECK (ward_user_id <> guardian_user_id),
         ADD CONSTRAINT guardian_links_status_check
           CHECK (status IN ('pending', 'active', 'revoked')),
         ADD CONSTRAINT guardian_links_revoked_at_check
           CHECK ((status = 'revoked') = (revoked_at IS NOT NULL)),
         ADD CONSTRAINT guardian_links_revocation_pair_check
           CHECK ((revocation_requested_at IS NULL) = (revocation_effective_at IS NULL)),
         ADD CONSTRAINT guardian_links_max_unlock_check
           CHECK (max_unlock_minutes BETWEEN 1 AND 240),
         ADD CONSTRAINT guardian_links_topic_check CHECK (ntfy_topic ~ '^[A-Za-z0-9_-]{1,64}$')`
    )
    this.schema.raw(
      `CREATE UNIQUE INDEX guardian_links_live_pair
         ON ${this.tableName} (ward_user_id, guardian_user_id) WHERE status <> 'revoked'`
    )
    this.schema.raw(
      `CREATE INDEX guardian_links_revocation_due
         ON ${this.tableName} (revocation_effective_at)
         WHERE status = 'active' AND revocation_effective_at IS NOT NULL`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
