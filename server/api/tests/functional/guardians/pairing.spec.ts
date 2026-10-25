// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import type { ApiClient, ApiResponse } from '@japa/api-client'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import Clock from '#services/clock'
import GuardianLink from '#models/guardian_link'
import { freezeTime } from '#tests/support/fixed_clock'
import { UserFactory } from '#tests/factories/user_factory'
import { guardianPair } from '#tests/factories/guardian_link_factory'
import { expectStatus } from '#tests/support/expect_response'
import { unsetEnv } from '#tests/support/env_override'
import { PAIRING_CODES, newPairingCode, redeem, wrongGuess } from '#tests/support/guardians'

const NOW = '2026-01-05T09:00:00Z'

test.group('Pairing codes (ward)', (group) => {
  group.each.setup(() => limiter.clear())
  group.each.teardown(() => app.container.restore(Clock))

  test('test_a_ward_gets_a_six_digit_code_once_with_a_qr_payload_of_url_and_code', async ({
    client,
    assert,
  }) => {
    freezeTime(NOW)
    const ward = await UserFactory.create()

    const response = await client.post('/api/v1/guardian/pairing-codes').actingAs(ward)

    response.assertStatus(201)
    response.assertHeader('cache-control', 'no-store')
    const body = response.body()
    assert.deepEqual(Object.keys(body).sort(), ['code', 'expiresAt', 'qrPayload'])
    assert.match(body.code, /^[0-9]{6}$/)
    assert.equal(body.expiresAt, '2026-01-05T09:10:00.000Z')
    assert.equal(body.qrPayload, `http://127.0.0.1:3333/pair#${body.code}`)
    assert.notInclude(body.qrPayload, ward.email)
    const rows = await db.from(PAIRING_CODES).where('ward_user_id', ward.id)
    assert.lengthOf(rows, 1)
    assert.notInclude(JSON.stringify(rows), body.code)
    assert.match(rows[0].code_hash, /^[0-9a-f]{64}$/)
    assert.equal(rows[0].attempts, 0)
  })

  test('test_the_code_lifetime_follows_pairing_code_ttl_minutes', async ({ client, assert }) => {
    freezeTime(NOW)
    env.set('PAIRING_CODE_TTL_MINUTES', 3)
    try {
      const { expiresAt } = await newPairingCode(client, await UserFactory.create())
      assert.equal(expiresAt, '2026-01-05T09:03:00.000Z')
    } finally {
      unsetEnv('PAIRING_CODE_TTL_MINUTES')
    }
  })

  test('test_a_new_code_replaces_the_pending_one', async ({ client, assert }) => {
    const ward = await UserFactory.create()
    const guardian = await UserFactory.create()
    const first = await newPairingCode(client, ward)
    const second = await newPairingCode(client, ward)

    await expectStatus(redeem(client, guardian, first.code), 400)
    await expectStatus(redeem(client, guardian, second.code), 201)
    const pending = await db.from(PAIRING_CODES).where('ward_user_id', ward.id).whereNull('used_at')
    assert.lengthOf(pending, 0)
  })

  test('test_concurrent_requests_leave_one_pending_code_per_ward', async ({ client, assert }) => {
    const ward = await UserFactory.create()

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => client.post('/api/v1/guardian/pairing-codes').actingAs(ward))
    )

    assert.isTrue(responses.every((response) => response.status() === 201))
    const pending = await db.from(PAIRING_CODES).where('ward_user_id', ward.id).whereNull('used_at')
    assert.lengthOf(pending, 1)
  })

  test('test_creating_pairing_codes_is_limited_to_ten_per_hour', async ({ client }) => {
    const ward = await UserFactory.create()
    for (let index = 0; index < 10; index++) await newPairingCode(client, ward)

    await expectStatus(client.post('/api/v1/guardian/pairing-codes').actingAs(ward), 429)
  })

  test('test_pairing_routes_need_a_session_and_csrf', async ({ client }) => {
    const user = await UserFactory.create()

    for (const url of ['/api/v1/guardian/pairing-codes', '/api/v1/guardian/pairings']) {
      await expectStatus(client.post(url).json({ code: '123456' }), 403)
      await expectStatus(client.post(url).json({ code: '123456' }).withCsrfToken(), 401)
      await expectStatus(
        client
          .post(url)
          .json({ code: '123456' })
          .loginAs(user)
          .withSession({ sv: user.sessionVersion }),
        403
      )
    }
  })
})

test.group('Pairings (guardian redeems a code)', (group) => {
  group.each.setup(() => limiter.clear())
  group.each.teardown(() => app.container.restore(Clock))

  test('test_a_signed_in_guardian_redeems_a_code_into_a_pending_link', async ({
    client,
    assert,
  }) => {
    freezeTime(NOW)
    const ward = await UserFactory.create()
    const guardian = await UserFactory.create()
    const { code } = await newPairingCode(client, ward)

    const response = await redeem(client, guardian, code)

    response.assertStatus(201)
    const { link } = response.body()
    assert.equal(link.role, 'guardian')
    assert.equal(link.status, 'pending')
    assert.equal(link.wardUserId, ward.id)
    assert.deepEqual(link.counterpart, { email: ward.email, fullName: ward.fullName })
    assert.equal(link.maxUnlockMinutes, 30)
    assert.isTrue(link.allowNotificationActions)
    assert.notInclude(JSON.stringify(response.body()), 'mf-')

    const row = await GuardianLink.findOrFail(link.id)
    assert.equal(row.wardUserId, ward.id)
    assert.equal(row.guardianUserId, guardian.id)
    assert.equal(row.status, 'pending')
    assert.match(row.ntfyTopic, /^mf-[a-z2-7]{26}$/)
    const used = await db.from(PAIRING_CODES).where('ward_user_id', ward.id).first()
    assert.equal(used.used_by_user_id, guardian.id)
    assert.equal(used.guardian_link_id, row.id)
    assert.isNotNull(used.used_at)
  })

  test('test_a_typed_code_may_carry_a_space', async ({ client }) => {
    const ward = await UserFactory.create()
    const { code } = await newPairingCode(client, ward)

    await expectStatus(
      redeem(client, await UserFactory.create(), `${code.slice(0, 3)} ${code.slice(3)}`),
      201
    )
  })

  test('test_a_wrong_expired_or_used_code_answers_the_same_400', async ({ client }) => {
    const clock = freezeTime(NOW)
    const ward = await UserFactory.create()
    const guardian = await UserFactory.create()
    const refused = {
      message: 'This pairing code is not valid. Ask for a new one',
      code: 'E_INVALID_PAIRING_CODE',
    }

    const used = await newPairingCode(client, ward)
    await expectStatus(redeem(client, guardian, used.code), 201)
    const again = await redeem(client, await UserFactory.create(), used.code)
    again.assertStatus(400)
    again.assertBody(refused)

    const other = await UserFactory.create()
    const expiring = await newPairingCode(client, other)
    clock.advance({ minutes: 10 })
    const late = await redeem(client, await UserFactory.create(), expiring.code)
    late.assertStatus(400)
    late.assertBody(refused)

    const wrong = await redeem(client, await UserFactory.create(), wrongGuess(expiring.code))
    wrong.assertStatus(400)
    wrong.assertBody(refused)

    await expectStatus(redeem(client, await UserFactory.create(), 'abcdef'), 422)
  })

  test('test_pairing_code_locks_after_5_attempts', async ({ client, assert }) => {
    const ward = await UserFactory.create()
    const { code } = await newPairingCode(client, ward)

    for (let index = 0; index < 5; index++) {
      const guesser = await UserFactory.create()
      await expectStatus(
        redeem(client, guesser, wrongGuess(code, index), `198.51.100.${index + 1}`),
        400
      )
    }

    const row = await db.from(PAIRING_CODES).where('ward_user_id', ward.id).first()
    assert.equal(row.attempts, 5)
    await expectStatus(redeem(client, await UserFactory.create(), code, '198.51.100.99'), 400)
    const links = await GuardianLink.query().where('ward_user_id', ward.id)
    assert.lengthOf(links, 0)
  })

  test('test_pairing_code_expires_after_10_minutes', async ({ client }) => {
    const clock = freezeTime(NOW)
    const ward = await UserFactory.create()
    const { code } = await newPairingCode(client, ward)

    clock.advance({ minutes: 9, seconds: 59 })
    await expectStatus(redeem(client, await UserFactory.create(), code), 201)

    const other = await newPairingCode(client, await UserFactory.create())
    clock.advance({ minutes: 10 })
    await expectStatus(redeem(client, await UserFactory.create(), other.code), 400)
  })

  test('test_ward_cannot_pair_with_self', async ({ client, assert }) => {
    const ward = await UserFactory.create()
    const { code } = await newPairingCode(client, ward)

    const response = await redeem(client, ward, code)

    response.assertStatus(409)
    response.assertBodyContains({ code: 'E_PAIRING_WITH_SELF' })
    const row = await db.from(PAIRING_CODES).where('ward_user_id', ward.id).first()
    assert.isNull(row.used_at, 'the code stays usable by someone else')
  })

  test('test_a_pair_holds_at_most_one_live_link', async ({ client, assert }) => {
    const { ward, guardian } = await guardianPair({ state: 'pending' })
    const { code } = await newPairingCode(client, ward)

    const response = await redeem(client, guardian, code)

    response.assertStatus(409)
    response.assertBodyContains({ code: 'E_GUARDIAN_LINK_EXISTS' })
    const links = await GuardianLink.query().where('ward_user_id', ward.id)
    assert.lengthOf(links, 1)
  })

  test('test_a_pair_can_link_again_after_a_revoked_link', async ({ client }) => {
    const { ward, guardian } = await guardianPair({ state: 'revoked' })
    const { code } = await newPairingCode(client, ward)

    await expectStatus(redeem(client, guardian, code), 201)
  })

  test('test_the_schema_refuses_two_live_links_for_a_pair_and_self_links', async ({ assert }) => {
    const { ward, guardian } = await guardianPair({ state: 'active' })
    const row = (overrides: Record<string, unknown>) => ({
      ward_user_id: ward.id,
      guardian_user_id: guardian.id,
      status: 'pending',
      ntfy_topic: `mf-${Math.random().toString(36).slice(2)}`,
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    })

    // Each insert in its own savepoint: a refused one aborts only that.
    const insert = (values: Record<string, unknown>) =>
      db.transaction((trx) => trx.table('guardian_links').insert(values))

    await assert.rejects(() => insert(row({})), /guardian_links_live_pair/)
    await assert.rejects(
      () => insert(row({ guardian_user_id: ward.id })),
      /guardian_links_not_self/
    )
  })

  test('test_redeeming_is_limited_to_ten_failures_per_hour_per_ip', async ({ client }) => {
    const ward = await UserFactory.create()
    const { code } = await newPairingCode(client, ward)
    const guesser = await UserFactory.create()

    for (let index = 0; index < 10; index++) {
      await expectStatus(
        redeem(client, guesser, `9${String(index).padStart(5, '0')}`, '203.0.113.7'),
        400
      )
    }
    await expectStatus(redeem(client, await UserFactory.create(), code, '203.0.113.7'), 429)
    await expectStatus(redeem(client, await UserFactory.create(), code, '203.0.113.8'), 201)
  })

  test('test_redeeming_is_limited_to_ten_failures_per_hour_per_account', async ({ client }) => {
    const guesser = await UserFactory.create()

    for (let index = 0; index < 10; index++) {
      await expectStatus(
        redeem(client, guesser, `8${String(index).padStart(5, '0')}`, `203.0.113.${index + 20}`),
        400
      )
    }
    await expectStatus(redeem(client, guesser, '800999', '203.0.113.99'), 429)
  })
})

/**
 * Concurrent guesses against the Postgres limiter store (production's):
 * the code's own counter is charged before a guess is compared, so a
 * burst on one code from many addresses compares at most five.
 */
test.group('Pairing guesses under concurrent bursts (database store)', (group) => {
  group.each.setup(async () => {
    env.set('LIMITER_STORE', 'database')
    await limiter.clear(['database'])
  })
  group.each.teardown(async () => {
    await limiter.clear(['database'])
    env.set('LIMITER_STORE', 'memory')
  })

  const count = (responses: ApiResponse[], status: number) =>
    responses.filter((response) => response.status() === status).length

  async function burst(client: ApiClient, code: string) {
    const guessers = await UserFactory.createMany(9)
    return Promise.all(
      guessers.map((guesser, index) =>
        redeem(client, guesser, wrongGuess(code, index), `192.0.2.${index + 1}`)
      )
    )
  }

  test('test_a_burst_on_one_pairing_code_compares_at_most_five_guesses', async ({
    client,
    assert,
  }) => {
    const ward = await UserFactory.create()
    const { code } = await newPairingCode(client, ward)

    const responses = await burst(client, code)

    assert.equal(count(responses, 400), 9)
    const row = await db.from(PAIRING_CODES).where('ward_user_id', ward.id).first()
    assert.equal(row.attempts, 5)
    await expectStatus(redeem(client, await UserFactory.create(), code, '192.0.2.200'), 400)
  })
})
