// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import limiter from '@adonisjs/limiter/services/main'
import { enrolledDevice } from '#tests/factories/device_factory'
import { UserFactory } from '#tests/factories/user_factory'
import { ACTIVITY_BLOCKS_TABLE } from '#services/analytics/activity_block_ingest'
import { MAX_ACTIVITY_BATCH } from '#validators/activity_blocks'
import { contractValidator } from '#tests/support/device_api'

const URL = '/api/v1/device/activity-blocks'

function aBlock(overrides: Record<string, unknown> = {}) {
  return {
    blockStart: '2026-01-05T09:00:00Z',
    activityKey: 'example.com',
    categoryPath: 'development',
    level: 100,
    source: 'web',
    seconds: 120,
    ...overrides,
  }
}

async function rowsOf(userId: number) {
  return db.from(ACTIVITY_BLOCKS_TABLE).where('user_id', userId).orderBy('id')
}

test.group('POST /api/v1/device/activity-blocks', (group) => {
  group.each.setup(() => limiter.clear())

  test('test_the_same_activity_batch_twice_adds_no_rows', async ({ client, assert }) => {
    const { user, device, token } = await enrolledDevice()
    const batch = {
      blocks: [aBlock(), aBlock({ activityKey: null, categoryPath: 'video', level: 0 })],
    }

    const first = await client.post(URL).json(batch).asDevice(token)
    const again = await client.post(URL).json(batch).asDevice(token)

    first.assertStatus(200)
    first.assertBody({ accepted: 2, updated: 0 })
    again.assertBody({ accepted: 0, updated: 2 })
    const validate = contractValidator('ActivityBlockBatchResult')
    assert.isTrue(validate(first.body()), JSON.stringify(validate.errors))
    const rows = await rowsOf(user.id)
    assert.deepEqual(
      rows.map((row) => [row.device_id, row.activity_key, row.category_path, row.seconds]),
      [
        [device.id, 'example.com', 'development', 120],
        [device.id, null, 'video', 120],
      ]
    )
  })

  test('test_a_resent_block_replaces_its_seconds', async ({ client, assert }) => {
    const { user, token } = await enrolledDevice()

    await client
      .post(URL)
      .json({ blocks: [aBlock({ seconds: 60 })] })
      .asDevice(token)
    await client
      .post(URL)
      .json({ blocks: [aBlock({ seconds: 240 })] })
      .asDevice(token)

    const rows = await rowsOf(user.id)
    assert.deepEqual(
      rows.map((row) => row.seconds),
      [240]
    )
  })

  test('test_a_block_repeated_in_one_batch_is_stored_once', async ({ client }) => {
    const { token } = await enrolledDevice()

    const response = await client
      .post(URL)
      .json({ blocks: [aBlock(), aBlock({ seconds: 200 })] })
      .asDevice(token)

    response.assertBody({ accepted: 1, updated: 0 })
  })

  test('test_an_invalid_block_answers_422_without_echoing_values', async ({ client, assert }) => {
    const { user, token } = await enrolledDevice()

    const response = await client
      .post(URL)
      .json({
        blocks: [
          aBlock({
            activityKey: 'https://secret.example/path?q=1',
            blockStart: '2026-01-05T09:03:00Z',
            seconds: 301,
          }),
        ],
      })
      .asDevice(token)

    response.assertStatus(422)
    assert.equal(response.body().code, 'validation_failed')
    assert.notInclude(response.text(), 'secret.example')
    assert.containsSubset(Object.keys(response.body().fields), [
      'blocks.0.activityKey',
      'blocks.0.blockStart',
      'blocks.0.seconds',
    ])
    assert.lengthOf(await rowsOf(user.id), 0)
  })

  test('test_a_batch_over_the_limit_is_refused', async ({ client }) => {
    const { token } = await enrolledDevice()
    const blocks = Array.from({ length: MAX_ACTIVITY_BATCH + 1 }, () => aBlock())

    const response = await client.post(URL).json({ blocks }).asDevice(token)

    response.assertStatus(422)
  })

  test('test_activity_blocks_need_a_device_token', async ({ client }) => {
    const user = await UserFactory.create()

    const anonymous = await client
      .post(URL)
      .json({ blocks: [aBlock()] })
      .header('X-Client-Version', 'android/0.1.0')
    const session = await client
      .post(URL)
      .json({ blocks: [aBlock()] })
      .header('X-Client-Version', 'android/0.1.0')
      .actingAs(user)

    anonymous.assertStatus(401)
    session.assertStatus(401)
  })
})

test.group('GET /api/v1/analytics/day and week', (group) => {
  group.each.setup(() => limiter.clear())

  test('test_a_day_sums_every_device_of_the_user', async ({ client, assert }) => {
    const { user, token } = await enrolledDevice()
    const second = await enrolledDevice(user)
    await client
      .post(URL)
      .json({ blocks: [aBlock({ seconds: 300 })] })
      .asDevice(token)
    await client
      .post(URL)
      .json({
        blocks: [
          aBlock({
            blockStart: '2026-01-05T10:00:00Z',
            activityKey: 'dev.example.app',
            source: 'android',
            categoryPath: 'video',
            level: 0,
            seconds: 100,
          }),
        ],
      })
      .asDevice(second.token)

    const response = await client.get('/api/v1/analytics/day?date=2026-01-05').actingAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.seconds, 400)
    assert.equal(body.pulse, 75)
    assert.deepEqual(body.secondsByLevel, { '0': 100, '25': 0, '50': 0, '75': 0, '100': 300 })
    assert.deepEqual(
      body.topActivityKeys.map((entry: { activityKey: string }) => entry.activityKey),
      ['example.com', 'dev.example.app']
    )
  })

  test('test_a_day_follows_the_users_time_zone', async ({ client, assert }) => {
    const user = await UserFactory.merge({ timeZone: 'America/New_York' }).create()
    const { token } = await enrolledDevice(user)
    await client
      .post(URL)
      .json({
        blocks: [
          aBlock({ blockStart: '2026-01-06T03:00:00Z', seconds: 60 }),
          aBlock({ blockStart: '2026-01-06T06:00:00Z', seconds: 90 }),
        ],
      })
      .asDevice(token)

    const day = await client.get('/api/v1/analytics/day?date=2026-01-05').actingAs(user)

    assert.equal(day.body().timeZone, 'America/New_York')
    assert.equal(day.body().seconds, 60)
    assert.deepEqual(
      day.body().days.map((entry: { date: string }) => entry.date),
      ['2026-01-05']
    )
  })

  test('test_a_week_lists_seven_local_days', async ({ client, assert }) => {
    const { user, token } = await enrolledDevice()
    await client
      .post(URL)
      .json({ blocks: [aBlock({ blockStart: '2026-01-07T12:00:00Z', seconds: 30 })] })
      .asDevice(token)

    const week = await client.get('/api/v1/analytics/week?start=2026-01-05').actingAs(user)

    week.assertStatus(200)
    assert.deepEqual(
      week.body().days.map((entry: { seconds: number }) => entry.seconds),
      [0, 0, 30, 0, 0, 0, 0]
    )
  })

  test('test_another_users_device_never_reaches_my_analytics', async ({ client, assert }) => {
    const me = await UserFactory.create()
    const other = await enrolledDevice()
    await client
      .post(URL)
      .json({ blocks: [aBlock({ seconds: 300 })] })
      .asDevice(other.token)

    const mine = await client.get('/api/v1/analytics/day?date=2026-01-05').actingAs(me)
    const byDevice = await client
      .get('/api/v1/analytics/day?date=2026-01-05')
      .header('Authorization', `Bearer ${other.token}`)

    assert.equal(mine.body().seconds, 0)
    assert.deepEqual(mine.body().topActivityKeys, [])
    byDevice.assertStatus(401)
  })

  test('test_an_impossible_date_answers_422', async ({ client }) => {
    const user = await UserFactory.create()

    const response = await client.get('/api/v1/analytics/day?date=2026-02-30').actingAs(user)
    const missing = await client.get('/api/v1/analytics/week').actingAs(user)

    response.assertStatus(422)
    missing.assertStatus(422)
  })
})
