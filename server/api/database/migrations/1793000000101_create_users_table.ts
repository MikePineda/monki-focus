// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Accounts of the dashboard. Every other server resource hangs from a user.
 *
 * - `email` is `citext`: unique and compared case-insensitively.
 * - `locale`, `time_zone` (IANA) and `week_start` (ISO weekday, 1 = Monday)
 *   drive days, weeks and scores, computed in the user's own zone.
 * - `session_version` is the revocation counter stamped in every session:
 *   bumping it ("log out everywhere", password change) ends older sessions.
 * - TOTP: the secret is encrypted with APP_KEY; `totp_enabled_at` null with
 *   a secret present means an enrolment waiting for its first code;
 *   `totp_last_used_step` refuses a code twice.
 * - `ntfy_topic` is the user's own notification topic (guardian packages).
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS citext')

    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.specificType('email', 'citext').notNullable().unique()
      table.string('full_name', 120).nullable()
      table.string('password', 255).notNullable()
      table.string('locale', 8).notNullable().defaultTo('en')
      table.string('time_zone', 64).notNullable().defaultTo('UTC')
      table.smallint('week_start').notNullable().defaultTo(1)
      table.boolean('is_admin').notNullable().defaultTo(false)
      table.integer('session_version').notNullable().defaultTo(0)
      table.text('totp_secret_encrypted').nullable()
      table.timestamp('totp_enabled_at', { useTz: true }).nullable()
      table.bigint('totp_last_used_step').nullable()
      table.string('ntfy_topic', 64).nullable().unique()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.raw(
      `ALTER TABLE ${this.tableName}
         ADD CONSTRAINT users_week_start_iso_weekday CHECK (week_start BETWEEN 1 AND 7)`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
