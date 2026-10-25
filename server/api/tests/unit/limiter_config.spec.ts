// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { databaseStoreOptions } from '#config/limiter'

test.group('Limiter config', () => {
  test('test_expired_rate_limit_rows_are_cleared_on_a_timer', ({ assert }) => {
    assert.equal(databaseStoreOptions.tableName, 'rate_limits')
    assert.isTrue(databaseStoreOptions.clearExpiredByTimeout)
  })

  test('test_the_database_store_has_its_own_connection_outside_any_transaction', ({ assert }) => {
    assert.equal(databaseStoreOptions.connectionName, 'limiter')
  })
  test('test_the_limiter_connection_fails_fast_when_postgres_is_slow_or_flooded', ({ assert }) => {
    const limiter = app.config.get<{
      pool: { max: number; acquireTimeoutMillis: number }
    }>('database.connections.limiter')

    assert.equal(limiter.pool.acquireTimeoutMillis, 5000)
    assert.equal(limiter.pool.max, 4)
  })
})
