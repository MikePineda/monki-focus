// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import { verifyTimeToken } from '@monki-focus/protocol'
import Clock from '#services/clock'
import Device from '#models/device'
import { freezeTime } from '#tests/support/fixed_clock'
import { enrolledDevice } from '#tests/factories/device_factory'
import { ACCESS_TOKENS_TABLE } from '#services/devices/device_tokens'
import { BYPASS_EVENTS_TABLE } from '#services/devices/bypass_event_recorder'
import { DEVICE_HEARTBEATS_TABLE } from '#services/devices/heartbeat_service'
import {
  BOOT,
  BypassAlerts,
  NONCE,
  OTHER_NONCE,
  bootKeys,
  contractValidator,
  fakeBypassAlerts,
  heartbeatBody,
  instanceKids,
  publishedKeyring,
} from '#tests/support/device_api'
import { expectStatus } from '#tests/support/expect_response'

const ISSUER = 'http://127.0.0.1:3333'

test.group('POST /api/v1/device/heartbeat', (group) => {
  group.each.setup(async () => {
    await limiter.clear()
    await bootKeys()
  })
  group.each.teardown(() => {
    app.container.restore(Clock)
    app.container.restore(BypassAlerts)
  })

  test('test_a_heartbeat_answers_a_time_token_bound_to_the_device_nonce_and_boot', async ({
    client,
    assert,
  }) => {
    freezeTime('2026-01-05T09:00:00Z')
    const { device, token } = await enrolledDevice()

    const response = await client
      .post('/api/v1/device/heartbeat')
      .json(await heartbeatBody())
      .asDevice(token)

    response.assertStatus(200)
    response.assertHeader('cache-control', 'no-store')
    const body = response.body()
    const validate = contractValidator('HeartbeatResponse')
    assert.isTrue(validate(body), JSON.stringify(validate.errors))
    assert.equal(body.serverTime, '2026-01-05T09:00:00Z')
    assert.equal(body.rulesVersion, 0)
    assert.isFalse(body.tokenRotationDue)

    const keyring = await publishedKeyring('unlock')
    const expected = { keyring, issuer: ISSUER, issuerProfile: 'development' as const }
    const verified = verifyTimeToken(body.timeToken, {
      ...expected,
      device: device.uuid,
      nonce: NONCE,
      boot: BOOT,
    })
    assert.isTrue(verified.ok, JSON.stringify(verified))
    if (verified.ok) {
      assert.equal(verified.value.claims.srv, '2026-01-05T09:00:00Z')
      assert.deepEqual(verified.value.claims.revoked, [])
      assert.isTrue(verified.value.claims.complete)
    }
    // Bound: another nonce, boot or device does not verify.
    for (const binding of [
      { device: device.uuid, nonce: OTHER_NONCE, boot: BOOT },
      { device: device.uuid, nonce: NONCE, boot: '42' },
      { device: '0d9e8f7a-6b5c-4d3e-9f2a-1b0c9d8e7f6a', nonce: NONCE, boot: BOOT },
    ]) {
      assert.isFalse(verifyTimeToken(body.timeToken, { ...expected, ...binding }).ok)
    }

    const keys = await client.get('/api/v1/keys').header('X-Client-Version', 'android/0.1.0')
    assert.equal(body.keysEtag, keys.header('etag'))
  })

  test('test_a_heartbeat_records_the_device_state_but_never_the_nonce', async ({
    client,
    assert,
  }) => {
    freezeTime('2026-01-05T09:00:00Z')
    const { device, token } = await enrolledDevice()

    const response = await client
      .post('/api/v1/device/heartbeat')
      .json(
        await heartbeatBody({
          clientTime: '2026-01-05T08:59:30Z',
          a11yEnabled: true,
          riskState: ['developer_options', 'usb_debugging'],
          goingOffline: true,
          unknownFutureField: 'ignored',
        })
      )
      .asDevice(token)

    response.assertStatus(200)
    const stored = await Device.findOrFail(device.id)
    assert.isTrue(stored.protectionActive)
    assert.isTrue(stored.a11yEnabled)
    assert.deepEqual(stored.riskState, ['developer_options', 'usb_debugging'])
    assert.deepEqual(stored.pinnedKids, await instanceKids())
    assert.isFalse(stored.keyPinMismatch)
    assert.equal(stored.clockOffsetMs, 30_000)
    assert.equal(stored.lastSeenAt.toUTC().toISO(), '2026-01-05T09:00:00.000Z')
    assert.equal(stored.announcedOfflineAt?.toUTC().toISO(), '2026-01-05T09:00:00.000Z')
    const rows = await db.from(DEVICE_HEARTBEATS_TABLE).where('device_id', device.id)
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].boot, BOOT)
    assert.isTrue(rows[0].going_offline)
    assert.notInclude(JSON.stringify(rows), NONCE)
    assert.notInclude(JSON.stringify(stored.toJSON()), NONCE)
  })

  test('test_pinned_kids_the_instance_never_published_raise_one_key_pin_mismatch', async ({
    client,
    assert,
  }) => {
    const alerts = fakeBypassAlerts()
    const { user, device, token } = await enrolledDevice()
    const own = await instanceKids()
    const proxied = { unlock: ['PROXYunlockKid01'], policy: own.policy }
    const beat = async (pinnedKids: object) =>
      client
        .post('/api/v1/device/heartbeat')
        .json(await heartbeatBody({ pinnedKids }))
        .asDevice(token)

    await expectStatus(beat(proxied), 200)
    await expectStatus(beat(proxied), 200)
    const flagged = await Device.findOrFail(device.id)
    assert.isTrue(flagged.keyPinMismatch)
    await expectStatus(beat({ unlock: ['PROXYunlockKid02'], policy: own.policy }), 200)

    const events = await db
      .from(BYPASS_EVENTS_TABLE)
      .where('ward_user_id', user.id)
      .where('kind', 'key_pin_mismatch')
      .orderBy('id')
    assert.lengthOf(events, 2)
    assert.equal(events[0].source, 'server')
    assert.deepEqual(events[0].details, { unknownUnlockKids: 'PROXYunlockKid01' })
    assert.deepEqual(alerts.kinds(), ['key_pin_mismatch', 'key_pin_mismatch'])

    await expectStatus(beat(own), 200)
    const cleared = await Device.findOrFail(device.id)
    assert.isFalse(cleared.keyPinMismatch)
  })

  test('test_a_malformed_heartbeat_answers_validation_failed_and_stores_nothing', async ({
    client,
    assert,
  }) => {
    const { device, token } = await enrolledDevice()

    const response = await client
      .post('/api/v1/device/heartbeat')
      .json(
        await heartbeatBody({
          nonce: 'too-short',
          protectionActive: 'true',
          clientTime: '2026-01-05 09:00:00',
          riskState: ['rooted'],
          pinnedKids: { unlock: [], policy: ['x'] },
        })
      )
      .asDevice(token)

    response.assertStatus(422)
    const validate = contractValidator('Error')
    assert.isTrue(validate(response.body()), JSON.stringify(validate.errors))
    assert.equal(response.body().code, 'validation_failed')
    assert.includeMembers(Object.keys(response.body().fields), [
      'nonce',
      'protectionActive',
      'clientTime',
    ])
    assert.lengthOf(await db.from(DEVICE_HEARTBEATS_TABLE).where('device_id', device.id), 0)
  })

  test('test_heartbeats_are_limited_to_sixty_per_hour_per_device', async ({ client }) => {
    const { token } = await enrolledDevice()
    const body = await heartbeatBody()
    for (let index = 0; index < 60; index++) {
      await expectStatus(client.post('/api/v1/device/heartbeat').json(body).asDevice(token), 200)
    }

    const refused = await client.post('/api/v1/device/heartbeat').json(body).asDevice(token)

    refused.assertStatus(429)
    refused.assertBody({ code: 'too_many_requests' })
  })

  test('test_a_thirty_day_old_token_is_hinted_for_rotation', async ({ client, assert }) => {
    const { device, token } = await enrolledDevice()
    await db
      .from(ACCESS_TOKENS_TABLE)
      .where('tokenable_id', device.id)
      .update({ created_at: DateTime.utc().minus({ days: 30, minutes: 1 }).toJSDate() })

    const response = await client
      .post('/api/v1/device/heartbeat')
      .json(await heartbeatBody())
      .asDevice(token)

    response.assertStatus(200)
    assert.isTrue(response.body().tokenRotationDue)
  })
})
