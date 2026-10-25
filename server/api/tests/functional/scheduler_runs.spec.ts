// SPDX-License-Identifier: AGPL-3.0-or-later
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import SchedulerRuns, {
  FINAL_FAILURE,
  MAX_ATTEMPTS,
  RETRYABLE_FAILURE,
  SCHEDULER_RUNS_TABLE,
} from '#scheduler/scheduler_runs'

const T0 = DateTime.fromISO('2026-01-05T09:00:00Z', { zone: 'utc' })
const KEY = { job: 'weekly_report', periodKey: '2026-W02', userId: 7 }

test.group('Scheduler run claims', () => {
  test('test_exactly_one_claim_wins_a_run', async ({ assert }) => {
    const runs = new SchedulerRuns()

    const [first, second] = await Promise.all([runs.claim(KEY, T0), runs.claim(KEY, T0)])

    assert.lengthOf([first, second].filter(Boolean), 1)
    assert.isTrue(await runs.isOpen(KEY))
  })

  test('test_instance_wide_runs_treat_null_users_as_equal', async ({ assert }) => {
    const runs = new SchedulerRuns()
    const key = { job: 'prune', periodKey: '2026-01-05' }

    assert.isNotNull(await runs.claim(key, T0))
    assert.isNull(await runs.claim(key, T0))
    assert.isNotNull(await runs.claim({ ...key, userId: 1 }, T0), 'a per-user run is separate')
  })

  test('test_a_finished_run_is_never_claimed_again', async ({ assert }) => {
    const runs = new SchedulerRuns()
    const claim = (await runs.claim(KEY, T0))!

    assert.isTrue(await runs.finish(claim, T0.plus({ minutes: 1 }), { outcome: 'sent' }))

    assert.isNull(await runs.claim(KEY, T0.plus({ days: 1 })))
    assert.isFalse(await runs.isOpen(KEY))
  })

  test('test_a_dead_owner_is_taken_over_after_thirty_minutes', async ({ assert }) => {
    const runs = new SchedulerRuns()
    const stale = (await runs.claim(KEY, T0))!

    assert.isNull(await runs.claim(KEY, T0.plus({ minutes: 29 })))
    const fresh = await runs.claim(KEY, T0.plus({ minutes: 31 }))

    assert.deepEqual(fresh, { id: stale.id, attempt: 2 })
    assert.isFalse(
      await runs.finish(stale, T0.plus({ minutes: 32 }), { outcome: 'sent' }),
      'the old owner can no longer finish it'
    )
  })

  test('test_a_retryable_failure_is_retried_after_an_hour_up_to_the_limit', async ({ assert }) => {
    const runs = new SchedulerRuns()
    let now = T0
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const claim = await runs.claim(KEY, now)
      assert.equal(claim?.attempt, attempt)
      await runs.finish(claim!, now, { outcome: RETRYABLE_FAILURE, error: 'ntfy unreachable' })
      assert.isNull(await runs.claim(KEY, now.plus({ minutes: 59 })), 'not before an hour')
      now = now.plus({ hours: 1, minutes: 1 })
    }

    assert.isNull(await runs.claim(KEY, now), 'attempts exhausted')
    assert.isFalse(await runs.isOpen(KEY))
  })

  test('test_a_final_failure_is_never_retried', async ({ assert }) => {
    const runs = new SchedulerRuns()
    const claim = (await runs.claim(KEY, T0))!
    await runs.finish(claim, T0, { outcome: FINAL_FAILURE, error: 'unusable model answer' })

    assert.isNull(await runs.claim(KEY, T0.plus({ hours: 5 })))
  })

  test('test_a_released_claim_is_free_at_once_and_gives_its_attempt_back', async ({ assert }) => {
    const runs = new SchedulerRuns()
    const claim = (await runs.claim(KEY, T0))!

    assert.isTrue(await runs.release(claim, T0))
    assert.isTrue(await runs.isOpen(KEY))
    assert.deepEqual(await runs.claim(KEY, T0), { id: claim.id, attempt: 1 })
  })

  test('test_long_errors_are_truncated_to_the_column', async ({ assert }) => {
    const runs = new SchedulerRuns()
    const claim = (await runs.claim(KEY, T0))!

    await runs.finish(claim, T0, { outcome: RETRYABLE_FAILURE, error: 'x'.repeat(900) })

    const row = await db.from(SCHEDULER_RUNS_TABLE).where('id', claim.id).firstOrFail()
    assert.lengthOf(row.error, 500)
  })
})
