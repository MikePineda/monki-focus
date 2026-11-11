// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Activity of every device in 5-minute blocks (S10): the `ActivityBlock` of
 * packages/rules (SEMANTICS.md §10.6), the only analytics record a device
 * sends. One row per (device, block start, source, activity key, category).
 *
 * - `block_start`: UTC, a multiple of 5 minutes.
 * - `activity_key`: a normalised domain or an app id, null when the user
 *   turned key sync off. Never a URL, a path or a title; never logged and
 *   never shown to a guardian.
 * - `category_path`, `level`: the device's categorisation of the key.
 * - `seconds`: 1..300; a re-sent block replaces the stored seconds.
 *
 * The unique constraint treats a null key as equal (NULLS NOT DISTINCT), so
 * the idempotent upsert also holds with key sync off. Device and user cascade.
 */
export default class extends BaseSchema {
  protected tableName = 'activity_blocks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table
        .integer('user_id')
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
      table.timestamp('block_start', { useTz: true }).notNullable()
      table.string('source', 16).notNullable()
      table.string('activity_key', 255).nullable()
      table.string('category_path', 96).notNullable()
      table.smallint('level').notNullable()
      table.smallint('seconds').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['user_id', 'block_start'], 'activity_blocks_user_block_start_index')
    })
    this.schema.raw(
      `ALTER TABLE ${this.tableName}
         ADD CONSTRAINT activity_blocks_block_start_check
           CHECK (extract(epoch FROM block_start)::bigint % 300 = 0),
         ADD CONSTRAINT activity_blocks_source_check CHECK (source IN ('web', 'app', 'android')),
         ADD CONSTRAINT activity_blocks_level_check CHECK (level IN (0, 25, 50, 75, 100)),
         ADD CONSTRAINT activity_blocks_seconds_check CHECK (seconds BETWEEN 1 AND 300),
         ADD CONSTRAINT activity_blocks_identity_unique
           UNIQUE NULLS NOT DISTINCT (device_id, block_start, source, activity_key, category_path)`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
