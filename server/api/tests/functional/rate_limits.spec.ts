// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import limiter from '@adonisjs/limiter/services/main'
import { errors } from '@adonisjs/limiter'

test.group('Rate limits (database store)', () => {
  test('test_the_database_store_counts_and_blocks_in_postgres', async ({ assert }) => {
    const store = limiter.use('database', { requests: 2, duration: '1 minute' })
    const key = 'test:ip_198.51.100.20'

    await store.consume(key)
    await store.consume(key)
    await assert.rejects(() => store.consume(key), errors.E_TOO_MANY_REQUESTS)
  })

  test('test_counters_land_in_the_rate_limits_table', async ({ assert }) => {
    const store = limiter.use('database', { requests: 5, duration: '1 minute' })

    await store.consume('test:ip_203.0.113.9')

    const remaining = await store.remaining('test:ip_203.0.113.9')
    assert.equal(remaining, 4)
  })
})
