// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto'
import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import Clock from '#services/clock'
import Device from '#models/device'
import type User from '#models/user'
import { freezeTime } from '#tests/support/fixed_clock'
import { UserFactory } from '#tests/factories/user_factory'
import { DeviceFactory } from '#tests/factories/device_factory'
import { ENROLLMENT_CODES_TABLE } from '#services/devices/enrollment_code_service'
import { ACCESS_TOKENS_TABLE } from '#services/devices/device_tokens'
import { BYPASS_EVENTS_TABLE } from '#services/devices/bypass_event_recorder'
import {
  BypassAlerts,
  bootKeys,
  contractValidator,
  fakeBypassAlerts,
  instanceKids,
} from '#tests/support/device_api'
import { expectStatus } from '#tests/support/expect_response'

const CLIENT_VERSION = 'android/0.1.0'

async function newCode(client: ApiClient, user: User) {
  const response = await client.post('/api/v1/devices/enrollment-codes').actingAs(user)
  response.assertStatus(201)
  return response.body().code as string
}

function enrol(client: ApiClient, code: string, overrides: Record<string, unknown> = {}) {
  return client
    .post('/api/v1/device/enroll')
    .header('X-Client-Version', CLIENT_VERSION)
    .json({ code, name: 'Test phone', platform: 'android', clientVersion: '0.1.0', ...overrides })
}

/** Same lookup part (first 3 characters), wrong proof. */
function wrongGuess(code: string, index = 0) {
  const tails = ['AAAAA', 'BBBBB', 'CCCCC', 'DDDDD', 'EEEEE', 'FFFFF', 'GGGGG', 'HHHHH']
  const tail = tails.find((candidate, i) => i >= index && candidate !== code.slice(3))!
  return code.slice(0, 3) + tail
}

test.group('Enrolment codes (dashboard)', (group) => {
  group.each.setup(async () => {
    await limiter.clear()
    await bootKeys()
  })
  group.each.teardown(() => app.container.restore(Clock))

  test('test_a_code_is_returned_once_with_the_issuer_and_the_kids_to_show', async ({
    client,
    assert,
  }) => {
    freezeTime('2026-01-05T09:00:00Z')
    const user = await UserFactory.create()

    const response = await client.post('/api/v1/devices/enrollment-codes').actingAs(user)

    response.assertStatus(201)
    response.assertHeader('cache-control', 'no-store')
    const body = response.body()
    assert.match(body.code, /^[A-Z2-7]{8}$/)
    assert.equal(body.expiresAt, '2026-01-05T09:10:00.000Z')
    assert.equal(body.issuer, 'http://127.0.0.1:3333')
    assert.deepEqual(body.kids, await instanceKids())
    const rows = await db.from(ENROLLMENT_CODES_TABLE).where('user_id', user.id)
    assert.lengthOf(rows, 1)
    assert.notInclude(JSON.stringify(rows), body.code)
    assert.match(rows[0].code_hash, /^[0-9a-f]{64}$/)
    assert.equal(rows[0].attempts, 0)
  })

  test('test_a_new_code_replaces_the_pending_one', async ({ client }) => {
    const user = await UserFactory.create()
    const first = await newCode(client, user)
    const second = await newCode(client, user)

    await expectStatus(enrol(client, first), 400)
    await expectStatus(enrol(client, second), 201)
  })

  test('test_concurrent_code_requests_leave_one_pending_code', async ({ client, assert }) => {
    const user = await UserFactory.create()

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        client.post('/api/v1/devices/enrollment-codes').actingAs(user)
      )
    )

    assert.isTrue(responses.every((response) => response.status() === 201))
    const pending = await db
      .from(ENROLLMENT_CODES_TABLE)
      .where('user_id', user.id)
      .whereNull('used_at')
    assert.lengthOf(pending, 1)
  })

  test('test_the_schema_refuses_a_second_pending_code_for_a_user', async ({ assert }) => {
    const user = await UserFactory.create()
    const row = (digit: string) => ({
      user_id: user.id,
      lookup_hash: digit.repeat(64),
      code_hash: digit.repeat(64),
      expires_at: new Date(Date.now() + 600_000),
      created_at: new Date(),
    })
    await db.table(ENROLLMENT_CODES_TABLE).insert(row('a'))

    await assert.rejects(
      () => db.table(ENROLLMENT_CODES_TABLE).insert(row('b')),
      /device_enrollment_codes_pending_user/
    )
  })

  test('test_creating_codes_is_limited_to_ten_per_hour_per_user', async ({ client }) => {
    const user = await UserFactory.create()
    for (let index = 0; index < 10; index++) await newCode(client, user)

    const response = await client.post('/api/v1/devices/enrollment-codes').actingAs(user)

    response.assertStatus(429)
  })

  test('test_a_user_with_twenty_active_devices_gets_no_more_codes', async ({ client }) => {
    const user = await UserFactory.create()
    await DeviceFactory.merge({ userId: user.id }).createMany(20)
    await DeviceFactory.apply('revoked').merge({ userId: user.id }).create()

    const response = await client.post('/api/v1/devices/enrollment-codes').actingAs(user)

    response.assertStatus(409)
    response.assertBody({
      message: 'You already have 20 devices. Remove one before adding another',
      code: 'E_DEVICE_LIMIT_REACHED',
    })
  })

  test('test_creating_a_code_needs_a_session_and_csrf', async ({ client }) => {
    const user = await UserFactory.create()

    await expectStatus(client.post('/api/v1/devices/enrollment-codes'), 403)
    await expectStatus(client.post('/api/v1/devices/enrollment-codes').withCsrfToken(), 401)
    await expectStatus(
      client.post('/api/v1/devices/enrollment-codes').loginAs(user).withSession({
        sv: user.sessionVersion,
      }),
      403
    )
  })
})

test.group('POST /api/v1/device/enroll', (group) => {
  group.each.setup(async () => {
    await limiter.clear()
    await bootKeys()
  })
  group.each.teardown(() => {
    app.container.restore(Clock)
    app.container.restore(BypassAlerts)
  })

  test('test_a_code_is_traded_for_a_device_and_a_token_returned_once', async ({
    client,
    assert,
  }) => {
    const alerts = fakeBypassAlerts()
    const user = await UserFactory.create()
    const code = await newCode(client, user)

    const response = await enrol(client, code, { name: '  Work laptop  ', platform: 'macos' })

    response.assertStatus(201)
    response.assertHeader('cache-control', 'no-store')
    const body = response.body()
    const validate = contractValidator('EnrollResponse')
    assert.isTrue(validate(body), JSON.stringify(validate.errors))
    assert.match(body.token, /^mfd_/)
    assert.equal(body.keys.issuer, 'http://127.0.0.1:3333')

    const device = await Device.findByOrFail('uuid', body.deviceUuid)
    assert.equal(device.userId, user.id)
    assert.equal(device.name, 'Work laptop')
    assert.equal(device.platform, 'macos')
    assert.isFalse(device.protectionActive)
    assert.deepEqual(device.enrolledKids, await instanceKids())
    assert.deepEqual(
      body.keys.keys.map((key: { kid: string }) => key.kid),
      [...device.enrolledKids.unlock, ...device.enrolledKids.policy]
    )

    // Hashed at rest: only the SHA-256 of the secret, never the token.
    const tokens = await db.from(ACCESS_TOKENS_TABLE).where('tokenable_id', device.id)
    assert.lengthOf(tokens, 1)
    assert.notInclude(JSON.stringify(tokens), body.token)
    const secret = Buffer.from(body.token.split('.')[1], 'base64url').toString('utf8')
    assert.equal(tokens[0].hash, createHash('sha256').update(secret).digest('hex'))
    assert.deepEqual(JSON.parse(tokens[0].abilities), ['device:*'])

    const codeRow = await db.from(ENROLLMENT_CODES_TABLE).where('user_id', user.id).first()
    assert.isNotNull(codeRow.used_at)
    assert.equal(codeRow.device_id, device.id)
    assert.deepEqual(alerts.kinds(), ['device_enrolled'])

    // Nothing hands the token out again.
    const listed = await client.get('/api/v1/devices').actingAs(user)
    assert.notInclude(JSON.stringify(listed.body()), body.token)
    assert.notInclude(JSON.stringify(listed.body()), tokens[0].hash)
  })

  test('test_a_code_works_only_once', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const code = await newCode(client, user)

    await expectStatus(enrol(client, code), 201)
    const again = await enrol(client, code)

    again.assertStatus(400)
    again.assertBody({ code: 'invalid_enrollment_code' })
    assert.lengthOf(await Device.query().where('user_id', user.id), 1)
  })

  test('test_concurrent_enrolments_with_the_right_code_create_one_device', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const code = await newCode(client, user)

    const responses = await Promise.all(Array.from({ length: 6 }, () => enrol(client, code)))

    assert.equal(responses.filter((response) => response.status() === 201).length, 1)
    assert.lengthOf(await Device.query().where('user_id', user.id), 1)
  })

  test('test_a_code_expires_after_ten_minutes', async ({ client }) => {
    const clock = freezeTime('2026-01-05T09:00:00Z')
    const user = await UserFactory.create()
    const code = await newCode(client, user)

    clock.advance({ minutes: 10 })
    const response = await enrol(client, code)

    response.assertStatus(400)
    response.assertBody({ code: 'invalid_enrollment_code' })
  })

  test('test_the_fifth_wrong_guess_kills_the_code', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const code = await newCode(client, user)

    for (let index = 0; index < 5; index++) {
      await expectStatus(enrol(client, wrongGuess(code, index)), 400)
    }
    const right = await enrol(client, code)

    right.assertStatus(400)
    right.assertBody({ code: 'invalid_enrollment_code' })
    const row = await db.from(ENROLLMENT_CODES_TABLE).where('user_id', user.id).first()
    assert.equal(row.attempts, 5)
    assert.isNull(row.used_at)
  })

  test('test_a_guess_matching_no_pending_code_spends_no_codes_attempt', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const code = await newCode(client, user)
    const elsewhere = (code[0] === 'Z' ? 'Y' : 'Z') + code.slice(1)

    await expectStatus(enrol(client, elsewhere), 400)

    const row = await db.from(ENROLLMENT_CODES_TABLE).where('user_id', user.id).first()
    assert.equal(row.attempts, 0)
    await expectStatus(enrol(client, code), 201)
  })

  test('test_ten_failures_per_ip_block_enrolment_for_fifteen_minutes', async ({ client }) => {
    for (let index = 0; index < 10; index++) {
      await expectStatus(enrol(client, `ZZZZZZ${'ABCDEFGHIJ'[index]}A`), 400)
    }

    const blocked = await enrol(client, 'ZZZZZZZZ')

    blocked.assertStatus(429)
    blocked.assertBody({ code: 'too_many_requests' })
    blocked.assertHeader('retry-after', '900')
  })

  test('test_a_malformed_request_answers_the_contract_validation_error', async ({
    client,
    assert,
  }) => {
    const response = await enrol(client, 'abc', { platform: 'windows', name: '' })

    response.assertStatus(422)
    const validate = contractValidator('Error')
    assert.isTrue(validate(response.body()), JSON.stringify(validate.errors))
    assert.equal(response.body().code, 'validation_failed')
    assert.includeMembers(Object.keys(response.body().fields), ['code', 'name', 'platform'])
  })

  test('test_enrolment_needs_a_client_version', async ({ client }) => {
    const response = await client.post('/api/v1/device/enroll').json({})

    response.assertStatus(422)
    response.assertBody({ code: 'validation_failed', fields: { 'X-Client-Version': 'invalid' } })
  })

  test('test_enrolment_stops_at_twenty_active_devices', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const code = await newCode(client, user)
    await DeviceFactory.merge({ userId: user.id }).createMany(20)

    const response = await enrol(client, code)

    response.assertStatus(409)
    response.assertBody({ code: 'device_limit_reached' })
    assert.lengthOf(await Device.query().where('user_id', user.id), 20)
    assert.lengthOf(await db.from(BYPASS_EVENTS_TABLE).where('ward_user_id', user.id), 0)
  })
})
