// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import { enrolledDevice } from '#tests/factories/device_factory'
import { BYPASS_EVENTS_TABLE } from '#services/devices/bypass_event_recorder'
import { BypassAlerts, contractValidator, fakeBypassAlerts } from '#tests/support/device_api'
import { expectBody } from '#tests/support/expect_response'

const URL = '/api/v1/device/bypass-events'

function event(dedupeKey: string, overrides: Record<string, unknown> = {}) {
  return {
    dedupeKey,
    kind: 'emergency_override',
    occurredAt: '2026-01-05T09:00:00.000Z',
    details: { targetGroup: 'social.video', waitSeconds: 120, granted: true },
    ...overrides,
  }
}

test.group('POST /api/v1/device/bypass-events', (group) => {
  group.each.setup(() => limiter.clear())
  group.each.teardown(() => app.container.restore(BypassAlerts))

  test('test_a_batch_is_stored_once_per_dedupe_key', async ({ client, assert }) => {
    const alerts = fakeBypassAlerts()
    const { user, device, token } = await enrolledDevice()
    const batch = { events: [event('a1b2'), event('c3d4', { kind: 'accessibility_disabled' })] }

    const first = await client.post(URL).json(batch).asDevice(token)
    const again = await client.post(URL).json(batch).asDevice(token)

    first.assertStatus(200)
    first.assertBody({ accepted: 2, duplicates: 0 })
    again.assertBody({ accepted: 0, duplicates: 2 })
    const validate = contractValidator('BypassEventBatchResult')
    assert.isTrue(validate(first.body()), JSON.stringify(validate.errors))

    const rows = await db.from(BYPASS_EVENTS_TABLE).where('ward_user_id', user.id).orderBy('id')
    assert.deepEqual(
      rows.map((row) => [row.kind, row.source, row.device_id, row.dedupe_key]),
      [
        ['emergency_override', 'client', device.id, `c:${device.uuid}:a1b2`],
        ['accessibility_disabled', 'client', device.id, `c:${device.uuid}:c3d4`],
      ]
    )
    assert.deepEqual(rows[0].details, {
      targetGroup: 'social.video',
      waitSeconds: 120,
      granted: true,
    })
    assert.equal(rows[0].occurred_at.toISOString(), '2026-01-05T09:00:00.000Z')
    assert.deepEqual(alerts.kinds(), ['emergency_override', 'accessibility_disabled'])
  })

  test('test_repeats_inside_one_batch_count_as_duplicates', async ({ client }) => {
    const { token } = await enrolledDevice()

    const response = await client
      .post(URL)
      .json({ events: [event('same'), event('same'), event('other')] })
      .asDevice(token)

    response.assertBody({ accepted: 2, duplicates: 1 })
  })

  test('test_two_devices_of_a_user_never_collide_on_a_dedupe_key', async ({ client }) => {
    const { user, token } = await enrolledDevice()
    const second = await enrolledDevice(user)

    await expectBody(
      client
        .post(URL)
        .json({ events: [event('k1')] })
        .asDevice(token),
      {
        accepted: 1,
        duplicates: 0,
      }
    )
    await expectBody(
      client
        .post(URL)
        .json({ events: [event('k1')] })
        .asDevice(second.token),
      {
        accepted: 1,
        duplicates: 0,
      }
    )
  })

  test('test_a_device_cannot_report_a_server_kind', async ({ client, assert }) => {
    const { user, token } = await enrolledDevice()

    for (const kind of ['heartbeat_missing', 'key_pin_mismatch', 'device_revoked', 'made_up']) {
      const response = await client
        .post(URL)
        .json({ events: [event('x', { kind })] })
        .asDevice(token)
      response.assertStatus(422)
      assert.equal(response.body().fields['events.0.kind'], 'enum')
    }
    assert.lengthOf(await db.from(BYPASS_EVENTS_TABLE).where('ward_user_id', user.id), 0)
  })

  test('test_details_carrying_a_url_or_free_text_are_refused', async ({ client, assert }) => {
    const { user, token } = await enrolledDevice()

    for (const details of [
      { site: 'https://video.example.com/watch' },
      { title: 'A page title with spaces' },
      { nested: { deep: 1 } },
      { 'bad key': 1 },
    ]) {
      const response = await client
        .post(URL)
        .json({ events: [event('ok'), event('x', { details })] })
        .asDevice(token)
      response.assertStatus(422)
      response.assertBody({ code: 'validation_failed', fields: { 'events.1.details': 'details' } })
    }
    assert.lengthOf(await db.from(BYPASS_EVENTS_TABLE).where('ward_user_id', user.id), 0)
  })

  test('test_a_batch_holds_one_to_a_hundred_events', async ({ client }) => {
    const { token } = await enrolledDevice()

    const empty = await client.post(URL).json({ events: [] }).asDevice(token)
    const tooMany = await client
      .post(URL)
      .json({ events: Array.from({ length: 101 }, (_, index) => event(`k${index}`)) })
      .asDevice(token)
    const full = await client
      .post(URL)
      .json({ events: Array.from({ length: 100 }, (_, index) => event(`k${index}`)) })
      .asDevice(token)

    empty.assertStatus(422)
    tooMany.assertStatus(422)
    full.assertBody({ accepted: 100, duplicates: 0 })
  })

  test('test_malformed_dedupe_keys_and_times_are_refused', async ({ client, assert }) => {
    const { token } = await enrolledDevice()

    const response = await client
      .post(URL)
      .json({
        events: [
          event('has space'),
          event('ok-1', { occurredAt: '2026-01-05T09:00:00+02:00' }),
          event('ok-2', { occurredAt: '2026-02-30T09:00:00Z' }),
        ],
      })
      .asDevice(token)

    response.assertStatus(422)
    assert.includeMembers(Object.keys(response.body().fields), [
      'events.0.dedupeKey',
      'events.1.occurredAt',
      'events.2.occurredAt',
    ])
  })
})
