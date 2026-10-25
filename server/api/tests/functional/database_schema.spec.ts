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
        WHERE table_name IN ('scheduler_runs', 'users', 'invitations', 'user_recovery_codes',
                             'devices', 'device_enrollment_codes', 'auth_access_tokens',
                             'device_heartbeats', 'bypass_events', 'guardian_links',
                             'pairing_codes', 'notification_outbox')
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
        'bypass_events.FOREIGN KEY (ward_user_id) REFERENCES users(id) ON DELETE CASCADE',
        'device_enrollment_codes.FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
        'devices.FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
        'guardian_links.FOREIGN KEY (guardian_user_id) REFERENCES users(id) ON DELETE CASCADE',
        'guardian_links.FOREIGN KEY (revoked_by_user_id) REFERENCES users(id) ON DELETE SET NULL',
        'guardian_links.FOREIGN KEY (ward_user_id) REFERENCES users(id) ON DELETE CASCADE',
        'invitations.FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE',
        'invitations.FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL',
        'notification_outbox.FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE',
        'pairing_codes.FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL',
        'pairing_codes.FOREIGN KEY (ward_user_id) REFERENCES users(id) ON DELETE CASCADE',
        'scheduler_runs.FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
        'user_recovery_codes.FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
      ]
    )
  })

  test('test_device_rows_go_with_their_device_and_codes_and_events_outlive_it', async ({
    assert,
  }) => {
    const result = await db.rawQuery<{ rows: Array<{ definition: string }> }>(
      `SELECT conrelid::regclass || '.' || pg_get_constraintdef(oid) AS definition
         FROM pg_constraint WHERE contype = 'f' AND confrelid = 'devices'::regclass
        ORDER BY 1`
    )

    assert.deepEqual(
      result.rows.map((row) => row.definition),
      [
        'auth_access_tokens.FOREIGN KEY (tokenable_id) REFERENCES devices(id) ON DELETE CASCADE',
        'bypass_events.FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL',
        'device_enrollment_codes.FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL',
        'device_heartbeats.FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE',
        'unlock_tokens.FOREIGN KEY (device_uuid) REFERENCES devices(uuid) ON DELETE CASCADE',
      ]
    )
  })

  test('test_a_pairing_code_outlives_the_link_it_made', async ({ assert }) => {
    const result = await db.rawQuery<{ rows: Array<{ definition: string }> }>(
      `SELECT conrelid::regclass || '.' || pg_get_constraintdef(oid) AS definition
         FROM pg_constraint WHERE contype = 'f' AND confrelid = 'guardian_links'::regclass
        ORDER BY 1`
    )

    assert.deepEqual(
      result.rows.map((row) => row.definition),
      [
        'pairing_codes.FOREIGN KEY (guardian_link_id) REFERENCES guardian_links(id) ON DELETE SET NULL',
      ]
    )
  })

  test('test_bypass_events_are_unique_per_user_and_dedupe_key', async ({ assert }) => {
    const result = await db.rawQuery<{ rows: Array<{ definition: string }> }>(
      `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
        WHERE conrelid = 'bypass_events'::regclass AND contype = 'u'`
    )

    assert.deepEqual(
      result.rows.map((row) => row.definition),
      ['UNIQUE (ward_user_id, dedupe_key)']
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
