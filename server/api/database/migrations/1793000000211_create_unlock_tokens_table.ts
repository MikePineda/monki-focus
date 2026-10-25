// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Ledger of issued unlock tokens (app/domain/unlock/unlock_token_ledger.ts):
 * what was signed, for which request and device, with which key, until
 * when, and whether it was revoked. Never the token itself: only its
 * SHA-256 (`token_hash`, lowercase hex).
 *
 * Revoked rows that are still usable (`expires_at` + 60 s skew in the
 * future) are listed in every time token of the device (partial index).
 *
 * `request_uuid` and `device_uuid` are the `req` and `dev` claims; their
 * foreign keys (ON DELETE CASCADE) are added by the packages that create
 * `unlock_requests` (S6) and `devices` (S4), in their own additive
 * migrations.
 */
export default class extends BaseSchema {
  protected tableName = 'unlock_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('jti').notNullable().unique()
      table.uuid('request_uuid').notNullable()
      table.uuid('device_uuid').notNullable()
      table.string('kid', 32).notNullable()
      table.specificType('token_hash', 'char(64)').notNullable().unique()
      table.timestamp('issued_at', { useTz: true }).notNullable()
      table.timestamp('not_before', { useTz: true }).notNullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('revoked_at', { useTz: true }).nullable()

      table.index(['request_uuid'])
    })
    this.schema.raw(
      `ALTER TABLE ${this.tableName}
         ADD CONSTRAINT unlock_tokens_times_check
           CHECK (issued_at <= not_before AND not_before < expires_at),
         ADD CONSTRAINT unlock_tokens_lifetime_check
           CHECK (expires_at - issued_at <= interval '4 hours'),
         ADD CONSTRAINT unlock_tokens_token_hash_check CHECK (token_hash ~ '^[0-9a-f]{64}$')`
    )
    this.schema.raw(
      `CREATE INDEX unlock_tokens_revoked_by_device
         ON ${this.tableName} (device_uuid, expires_at) WHERE revoked_at IS NOT NULL`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
