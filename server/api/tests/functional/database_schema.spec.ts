// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

async function columnsOf(table: string): Promise<string[]> {
  const result = await db.rawQuery<{ rows: Array<{ column_name: string }> }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = ? ORDER BY column_name`,
    [table]
  )
  return result.rows.map((row) => row.column_name)
}

test.group('Database schema', () => {
  test('test_rate_limits_has_the_limiter_store_shape', async ({ assert }) => {
    assert.deepEqual(await columnsOf('rate_limits'), ['expire', 'key', 'points'])
  })

  test('test_scheduler_runs_is_unique_per_job_period_and_user_with_nulls_equal', async ({
    assert,
  }) => {
    const result = await db.rawQuery<{ rows: Array<{ definition: string }> }>(
      `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
        WHERE conname = 'scheduler_runs_job_period_user_unique'`
    )

    assert.equal(result.rows[0]?.definition, 'UNIQUE NULLS NOT DISTINCT (job, period_key, user_id)')
  })

  test('test_timestamps_are_timestamptz', async ({ assert }) => {
    const result = await db.rawQuery<{ rows: Array<{ column_name: string; data_type: string }> }>(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = 'scheduler_runs' AND column_name LIKE '%_at'`
    )

    assert.isAbove(result.rows.length, 0)
    for (const row of result.rows) {
      assert.equal(row.data_type, 'timestamp with time zone', row.column_name)
    }
  })
})
