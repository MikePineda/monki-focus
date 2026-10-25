// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import Device from '#models/device'
import { enrolledDevice, DeviceFactory, SYNTHETIC_KIDS } from '#tests/factories/device_factory'
import { UserFactory } from '#tests/factories/user_factory'
import { ACCESS_TOKENS_TABLE } from '#services/devices/device_tokens'
import { BYPASS_EVENTS_TABLE } from '#services/devices/bypass_event_recorder'
import { BypassAlerts, fakeBypassAlerts } from '#tests/support/device_api'
import { expectStatus } from '#tests/support/expect_response'

test.group('Devices (dashboard)', (group) => {
  group.each.setup(() => limiter.clear())
  group.each.teardown(() => app.container.restore(BypassAlerts))

  test('test_the_user_lists_own_devices_with_their_kids_and_never_a_token', async ({
    client,
    assert,
  }) => {
    const { user, device, token } = await enrolledDevice()
    await DeviceFactory.apply('revoked').merge({ userId: user.id }).create()

    const response = await client.get('/api/v1/devices').actingAs(user)

    response.assertStatus(200)
    const devices = response.body().devices
    assert.lengthOf(devices, 2)
    assert.equal(devices[0].uuid, device.uuid)
    assert.equal(devices[0].status, 'active')
    assert.equal(devices[1].status, 'revoked')
    assert.deepEqual(devices[0].enrolledKids, SYNTHETIC_KIDS)
    assert.properties(devices[0], [
      'name',
      'platform',
      'protectionActive',
      'pinnedKids',
      'keyPinMismatch',
      'lastSeenAt',
      'deadmanHours',
    ])
    const text = JSON.stringify(response.body())
    assert.notInclude(text, token)
    assert.notProperty(devices[0], 'id')
    assert.notProperty(devices[0], 'userId')
    assert.notProperty(devices[0], 'lastBoot')
  })

  test('test_the_user_renames_a_device_and_sets_its_dead_man_threshold', async ({
    client,
    assert,
  }) => {
    const { user, device } = await enrolledDevice()

    const response = await client
      .patch(`/api/v1/devices/${device.uuid}`)
      .json({ name: '  Kitchen tablet ', deadmanHours: 12 })
      .actingAs(user)

    response.assertStatus(200)
    response.assertBodyContains({ device: { name: 'Kitchen tablet', deadmanHours: 12 } })
    const stored = await Device.findOrFail(device.id)
    assert.equal(stored.name, 'Kitchen tablet')
    assert.equal(stored.deadmanHours, 12)
  })

  test('test_invalid_device_changes_are_refused', async ({ client, assert }) => {
    const { user, device } = await enrolledDevice()

    for (const body of [
      { deadmanHours: 0 },
      { deadmanHours: 49 },
      { deadmanHours: 1.5 },
      { name: 'x'.repeat(65) },
      { name: 'line\nbreak' },
    ]) {
      const response = await client
        .patch(`/api/v1/devices/${device.uuid}`)
        .json(body)
        .actingAs(user)
      assert.equal(response.status(), 422, JSON.stringify(body))
    }
  })

  test('test_revoking_deletes_the_tokens_and_tells_the_guardian_port', async ({
    client,
    assert,
  }) => {
    const alerts = fakeBypassAlerts()
    const { user, device } = await enrolledDevice()

    const response = await client.delete(`/api/v1/devices/${device.uuid}`).actingAs(user)

    response.assertStatus(204)
    const stored = await Device.findOrFail(device.id)
    assert.isNotNull(stored.revokedAt)
    assert.lengthOf(await db.from(ACCESS_TOKENS_TABLE).where('tokenable_id', device.id), 0)
    const events = await db.from(BYPASS_EVENTS_TABLE).where('ward_user_id', user.id)
    assert.deepEqual(
      events.map((event) => [event.kind, event.source, event.device_id]),
      [['device_revoked', 'server', device.id]]
    )
    assert.deepEqual(alerts.kinds(), ['device_revoked'])
  })

  test('test_a_revoked_device_can_be_neither_revoked_again_nor_renamed', async ({ client }) => {
    const { user, device } = await enrolledDevice()
    await expectStatus(client.delete(`/api/v1/devices/${device.uuid}`).actingAs(user), 204)

    const again = await client.delete(`/api/v1/devices/${device.uuid}`).actingAs(user)
    const rename = await client
      .patch(`/api/v1/devices/${device.uuid}`)
      .json({ name: 'Back' })
      .actingAs(user)

    again.assertStatus(404)
    rename.assertStatus(404)
  })

  test('test_device_routes_need_a_session', async ({ client }) => {
    const { device } = await enrolledDevice()

    await expectStatus(client.get('/api/v1/devices'), 401)
    await expectStatus(client.delete(`/api/v1/devices/${device.uuid}`).withCsrfToken(), 401)
  })

  test('test_the_export_lists_devices_and_bypass_events_without_secrets', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const { device, token } = await enrolledDevice(user)
    await expectStatus(client.delete(`/api/v1/devices/${device.uuid}`).actingAs(user), 204)

    const response = await client.get('/api/v1/me/export').actingAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.deepEqual(
      body.devices.map((entry: { uuid: string; status: string }) => [entry.uuid, entry.status]),
      [[device.uuid, 'revoked']]
    )
    assert.deepEqual(
      body.bypassEvents.map((entry: { kind: string; deviceUuid: string }) => [
        entry.kind,
        entry.deviceUuid,
      ]),
      [['device_revoked', device.uuid]]
    )
    const text = JSON.stringify(body)
    assert.notInclude(text, token)
    assert.notInclude(text, 'dedupe')
  })
})
