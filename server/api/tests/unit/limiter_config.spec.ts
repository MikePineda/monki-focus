// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { databaseStoreOptions } from '#config/limiter'

test.group('Limiter config', () => {
  test('test_expired_rate_limit_rows_are_cleared_on_a_timer', ({ assert }) => {
    assert.equal(databaseStoreOptions.tableName, 'rate_limits')
    assert.isTrue(databaseStoreOptions.clearExpiredByTimeout)
  })
})
