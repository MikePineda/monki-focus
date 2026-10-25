// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Lock and log of the in-process scheduler (app/scheduler): one row per job,
 * period and user (NULL user = an instance-wide job). The unique key treats
 * NULLs as equal (Postgres 15+), so claiming a run is an
 * `INSERT ... ON CONFLICT DO NOTHING` whoever runs it. `attempts`,
 * `finished_at` and `error` drive the takeover of dead or failed runs;
 * `outcome` is a short code ('sent', 'skipped:no-activity', 'failed').
 * Plain strings, no native enum: jobs come and go without a migration.
 *
 * `user_id` has no foreign key yet because `users` arrives later (S2); the
 * users package adds `REFERENCES users(id) ON DELETE CASCADE` in its own
 * additive migration.
 */
export default class extends BaseSchema {
  protected tableName = 'scheduler_runs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('job', 64).notNullable()
      table.string('period_key', 32).notNullable()
      table.integer('user_id').unsigned().nullable()
      table.smallint('attempts').notNullable().defaultTo(1)
      table.timestamp('started_at', { useTz: true }).notNullable()
      table.timestamp('finished_at', { useTz: true }).nullable()
      table.string('outcome', 40).nullable()
      table.string('error', 500).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['started_at'])
    })
    this.schema.raw(
      `ALTER TABLE ${this.tableName}
         ADD CONSTRAINT scheduler_runs_job_period_user_unique
         UNIQUE NULLS NOT DISTINCT (job, period_key, user_id)`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
