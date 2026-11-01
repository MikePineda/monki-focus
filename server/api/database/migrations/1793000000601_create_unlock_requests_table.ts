// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Unlock requests (app/domain/unlock/unlock_request_state.ts): a device
 * asks the ward's guardian to lift one scope for some minutes.
 *
 * - `scope` is the token claim's `{kind, value[, includeSubdomains]}`
 *   (domain, path or app; never a wildcard). `reason` is the user's own
 *   text for the guardian, at most 280 characters. Neither is ever logged
 *   nor sent through ntfy.
 * - `policy_hash` is the device's policy hash when it asked: the unlock
 *   token's `pol` claim.
 * - `approve_action_hash` / `deny_action_hash`: SHA-256 (hex) of the two
 *   ntfy capability tokens, valid until `action_expires_at`; both are
 *   cleared on any decision, cancellation or expiry.
 * - `token_sealed`: the issued unlock token encrypted with APP_KEY, so the
 *   device's poll (and its online revalidation) can get it again while it
 *   is valid; the ledger (`unlock_tokens`) keeps only its hash.
 * - The ward's and the device's rows cascade; the link and the deciding
 *   user are kept as history (SET NULL).
 */
export default class extends BaseSchema {
  protected tableName = 'unlock_requests'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('uuid').notNullable().unique()
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
        .notNullable()
        .references('id')
        .inTable('devices')
        .onDelete('CASCADE')
      table
        .integer('guardian_link_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('guardian_links')
        .onDelete('SET NULL')
      table.string('rule_id', 64).notNullable()
      table.jsonb('scope').notNullable()
      table.smallint('requested_minutes').notNullable()
      table.smallint('granted_minutes').nullable()
      table.string('reason', 280).nullable()
      table.string('policy_hash', 43).notNullable()
      table.string('status', 16).notNullable().defaultTo('pending')
      table.specificType('approve_action_hash', 'char(64)').nullable().unique()
      table.specificType('deny_action_hash', 'char(64)').nullable().unique()
      table.timestamp('action_expires_at', { useTz: true }).nullable()
      table.text('token_sealed').nullable()
      table
        .integer('decided_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.string('decided_via', 16).nullable()
      table.timestamp('decided_at', { useTz: true }).nullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['device_id', 'created_at'])
      table.index(['guardian_link_id'])
    })
    this.schema.raw(
      `ALTER TABLE ${this.tableName}
         ADD CONSTRAINT unlock_requests_status_check
           CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'cancelled')),
         ADD CONSTRAINT unlock_requests_decided_via_check
           CHECK (decided_via IS NULL OR decided_via IN ('notification', 'web')),
         ADD CONSTRAINT unlock_requests_minutes_check
           CHECK (requested_minutes BETWEEN 1 AND 120
             AND (granted_minutes IS NULL OR granted_minutes BETWEEN 1 AND 120)),
         ADD CONSTRAINT unlock_requests_action_hashes_check
           CHECK ((approve_action_hash IS NULL OR approve_action_hash ~ '^[0-9a-f]{64}$')
             AND (deny_action_hash IS NULL OR deny_action_hash ~ '^[0-9a-f]{64}$'))`
    )
    this.schema.raw(
      `CREATE INDEX unlock_requests_ward_recent
         ON ${this.tableName} (ward_user_id, created_at DESC)`
    )
    this.schema.raw(
      `CREATE INDEX unlock_requests_pending_due
         ON ${this.tableName} (expires_at) WHERE status = 'pending'`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
