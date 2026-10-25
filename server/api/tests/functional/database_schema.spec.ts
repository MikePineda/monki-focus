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
        WHERE table_name IN ('scheduler_runs', 'users', 'invitations', 'user_recovery_codes')
          AND column_name LIKE '%_at'`
    )

    assert.isAbove(result.rows.length, 0)
    for (const row of result.rows) {
      assert.equal(row.data_type, 'timestamp with time zone', row.column_name)
    }
  })

  test('test_emails_are_citext_and_unique', async ({ assert }) => {
    const result = await db.rawQuery<{ rows: Array<{ table_name: string; udt_name: string }> }>(
      `SELECT table_name, udt_name FROM information_schema.columns
        WHERE column_name = 'email' AND table_name IN ('users', 'invitations')
        ORDER BY table_name`
    )

    assert.deepEqual(result.rows, [
      { table_name: 'invitations', udt_name: 'citext' },
      { table_name: 'users', udt_name: 'citext' },
    ])
    await db.table('users').insert(rowOf('Someone@example.com'))
    await assert.rejects(() => db.table('users').insert(rowOf('SOMEONE@example.com')))
  })

  test('test_week_start_is_an_iso_weekday', async ({ assert }) => {
    await assert.rejects(() =>
      db.table('users').insert({ ...rowOf('w@example.com'), week_start: 0 })
    )
  })

  test('test_user_rows_cascade_and_accepted_invitations_are_unlinked', async ({ assert }) => {
    const result = await db.rawQuery<{ rows: Array<{ definition: string }> }>(
      `SELECT conrelid::regclass || '.' || pg_get_constraintdef(oid) AS definition
         FROM pg_constraint WHERE contype = 'f' AND confrelid = 'users'::regclass
        ORDER BY 1`
    )

    assert.deepEqual(
      result.rows.map((row) => row.definition),
      [
        'invitations.FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE',
        'invitations.FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL',
        'scheduler_runs.FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
        'user_recovery_codes.FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
      ]
    )
  })
})

/** A raw users row (bypasses the model: the hash is irrelevant here). */
function rowOf(email: string) {
  return {
    email,
    password: 'not-a-real-hash',
    created_at: new Date(),
    updated_at: new Date(),
  }
}
