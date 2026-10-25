// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import limiter from '@adonisjs/limiter/services/main'
import Device from '#models/device'
import { enrolledDevice, DeviceFactory } from '#tests/factories/device_factory'
import { ACCESS_TOKENS_TABLE } from '#services/devices/device_tokens'
import { bootKeys, contractValidator, heartbeatBody } from '#tests/support/device_api'
import { expectStatus } from '#tests/support/expect_response'

const HEARTBEAT = '/api/v1/device/heartbeat'

test.group('Device tokens', (group) => {
  group.each.setup(async () => {
    await limiter.clear()
    await bootKeys()
  })

  test('test_a_missing_unknown_or_malformed_token_answers_401_unauthorized', async ({
    client,
    assert,
  }) => {
    const { token } = await enrolledDevice()
    const [prefix, secret] = token.split('.')
    const validate = contractValidator('Error')

    for (const candidate of [
      undefined,
      'not-a-token',
      `${prefix}.${secret.slice(0, -2)}xx`,
      `mfd_OTk5OTk.${secret}`,
      `oat_${token.slice(4)}`,
    ]) {
      const request = client.post(HEARTBEAT).json(await heartbeatBody())
      const response = await (candidate === undefined
        ? request.header('X-Client-Version', 'android/0.1.0')
        : request.asDevice(candidate))
      response.assertStatus(401)
      response.assertBody({ code: 'unauthorized' })
      assert.isTrue(validate(response.body()))
    }
  })

  test('test_a_revoked_device_token_answers_401', async ({ client }) => {
    const { user, device, token } = await enrolledDevice()

    await expectStatus(client.delete(`/api/v1/devices/${device.uuid}`).actingAs(user), 204)
    const response = await client
      .post(HEARTBEAT)
      .json(await heartbeatBody())
      .asDevice(token)

    response.assertStatus(401)
    response.assertBody({ code: 'unauthorized' })
  })

  test('test_a_revoked_device_is_refused_even_if_a_token_survived', async ({ client }) => {
    const { device, token } = await enrolledDevice()
    // Revoked without going through the registry (which deletes tokens): the second lock.
    await Device.query().where('id', device.id).update({ revoked_at: DateTime.utc().toJSDate() })

    const response = await client
      .post(HEARTBEAT)
      .json(await heartbeatBody())
      .asDevice(token)

    response.assertStatus(401)
  })

  test('test_device_token_ability_scope_enforced', async ({ client }) => {
    const device = await DeviceFactory.with('user').create()
    const narrow = await Device.accessTokens.create(device, ['something:else'])

    const response = await client
      .post(HEARTBEAT)
      .json(await heartbeatBody())
      .asDevice(narrow.value!.release())

    response.assertStatus(401)
  })

  test('test_device_routes_ignore_the_session_cookie_and_set_none', async ({ client, assert }) => {
    const { user } = await enrolledDevice()

    const response = await client
      .post(HEARTBEAT)
      .header('X-Client-Version', 'android/0.1.0')
      .json(await heartbeatBody())
      .actingAs(user)

    response.assertStatus(401)
    response.assertBody({ code: 'unauthorized' })
    assert.isUndefined(response.header('set-cookie'))
  })

  test('test_dashboard_routes_reject_a_device_bearer_token', async ({ client }) => {
    const { device, token } = await enrolledDevice()

    const list = await client.get('/api/v1/devices').asDevice(token)
    const rename = await client
      .patch(`/api/v1/devices/${device.uuid}`)
      .json({ name: 'Renamed' })
      .withCsrfToken()
      .asDevice(token)
    const me = await client.get('/api/v1/auth/me').asDevice(token)

    list.assertStatus(401)
    list.assertBodyContains({ code: 'E_UNAUTHORIZED_ACCESS' })
    rename.assertStatus(401)
    me.assertStatus(401)
  })

  test('test_device_responses_never_set_a_cookie', async ({ client, assert }) => {
    const { token } = await enrolledDevice()

    const response = await client
      .post(HEARTBEAT)
      .json(await heartbeatBody())
      .asDevice(token)

    response.assertStatus(200)
    assert.isUndefined(response.header('set-cookie'))
  })
})

test.group('POST /api/v1/device/token/rotate', (group) => {
  group.each.setup(async () => {
    await limiter.clear()
    await bootKeys()
  })

  test('test_rotation_returns_a_new_token_and_retires_the_old_one_after_a_grace', async ({
    client,
    assert,
  }) => {
    const { device, token } = await enrolledDevice()

    const response = await client.post('/api/v1/device/token/rotate').asDevice(token)

    response.assertStatus(201)
    response.assertHeader('cache-control', 'no-store')
    const validate = contractValidator('TokenRotation')
    assert.isTrue(validate(response.body()), JSON.stringify(validate.errors))
    const fresh = response.body().token as string
    assert.notEqual(fresh, token)
    await expectStatus(
      client
        .post(HEARTBEAT)
        .json(await heartbeatBody())
        .asDevice(fresh),
      200
    )
    // The old token keeps working for the grace, then it is gone.
    await expectStatus(
      client
        .post(HEARTBEAT)
        .json(await heartbeatBody())
        .asDevice(token),
      200
    )
    const rows = await db.from(ACCESS_TOKENS_TABLE).where('tokenable_id', device.id).orderBy('id')
    assert.lengthOf(rows, 2)
    assert.isNotNull(rows[0].expires_at)
    assert.isAtMost(rows[0].expires_at.getTime() - Date.now(), 10 * 60 * 1000)
    assert.isNull(rows[1].expires_at)

    await db
      .from(ACCESS_TOKENS_TABLE)
      .where('id', rows[0].id)
      .update({ expires_at: DateTime.utc().minus({ seconds: 1 }).toJSDate() })
    await expectStatus(
      client
        .post(HEARTBEAT)
        .json(await heartbeatBody())
        .asDevice(token),
      401
    )
  })

  test('test_a_retried_rotation_keeps_only_the_newest_token_and_the_grace', async ({
    client,
    assert,
  }) => {
    const { device, token } = await enrolledDevice()

    const lost = await client.post('/api/v1/device/token/rotate').asDevice(token)
    const retried = await client.post('/api/v1/device/token/rotate').asDevice(token)

    retried.assertStatus(201)
    await expectStatus(
      client
        .post(HEARTBEAT)
        .json(await heartbeatBody())
        .asDevice(lost.body().token),
      401
    )
    await expectStatus(
      client
        .post(HEARTBEAT)
        .json(await heartbeatBody())
        .asDevice(retried.body().token),
      200
    )
    assert.lengthOf(await db.from(ACCESS_TOKENS_TABLE).where('tokenable_id', device.id), 2)
  })

  test('test_rotation_needs_a_device_token', async ({ client }) => {
    const response = await client
      .post('/api/v1/device/token/rotate')
      .header('X-Client-Version', 'macos/0.1.0')

    response.assertStatus(401)
    response.assertBody({ code: 'unauthorized' })
  })
})
