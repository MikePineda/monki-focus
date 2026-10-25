// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { HEALTH_CACHE_TTL_MS, HealthReportCache } from '#services/health_report_cache'

function fakeClock(start = 0) {
  let now = start
  return { now: () => now, advance: (ms: number) => (now += ms) }
}

test.group('Health report cache', () => {
  test('test_probes_within_a_second_share_one_run', async ({ assert }) => {
    const clock = fakeClock()
    const cache = new HealthReportCache<number>(clock.now)
    let runs = 0
    const run = async () => ++runs

    assert.equal(await cache.get(run), 1)
    clock.advance(HEALTH_CACHE_TTL_MS - 1)
    assert.equal(await cache.get(run), 1)
    clock.advance(1)
    assert.equal(await cache.get(run), 2)
    assert.equal(HEALTH_CACHE_TTL_MS, 1000)
  })

  test('test_concurrent_probes_share_the_run_in_flight', async ({ assert }) => {
    const cache = new HealthReportCache<number>(fakeClock().now)
    let runs = 0
    const run = async () => {
      runs++
      await new Promise((resolve) => setTimeout(resolve, 5))
      return runs
    }

    await Promise.all([cache.get(run), cache.get(run), cache.get(run)])

    assert.equal(runs, 1)
  })

  test('test_a_failed_run_is_not_kept', async ({ assert }) => {
    const cache = new HealthReportCache<number>(fakeClock().now)
    let runs = 0

    await assert.rejects(() =>
      cache.get(async () => {
        runs++
        throw new Error('database down')
      })
    )
    assert.equal(await cache.get(async () => ++runs), 2)
  })
})
