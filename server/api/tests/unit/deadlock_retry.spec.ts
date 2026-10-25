// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { retryOnDeadlock } from '#services/database/deadlock_retry'

const deadlock = () => Object.assign(new Error('deadlock detected'), { code: '40P01' })

test.group('Deadlock retry', () => {
  test('test_a_deadlocked_transaction_is_run_once_more', async ({ assert }) => {
    let runs = 0

    const result = await retryOnDeadlock(async () => {
      runs++
      if (runs === 1) throw deadlock()
      return 'done'
    })

    assert.equal(result, 'done')
    assert.equal(runs, 2)
  })

  test('test_a_second_deadlock_is_not_retried_again', async ({ assert }) => {
    let runs = 0

    await assert.rejects(
      () =>
        retryOnDeadlock(async () => {
          runs++
          throw deadlock()
        }),
      /deadlock detected/
    )
    assert.equal(runs, 2)
  })

  test('test_other_errors_are_never_retried', async ({ assert }) => {
    let runs = 0

    await assert.rejects(
      () =>
        retryOnDeadlock(async () => {
          runs++
          throw Object.assign(new Error('unique'), { code: '23505' })
        }),
      /unique/
    )
    assert.equal(runs, 1)
  })
})
