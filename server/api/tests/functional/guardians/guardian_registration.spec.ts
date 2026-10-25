// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import Clock from '#services/clock'
import User from '#models/user'
import GuardianLink from '#models/guardian_link'
import { freezeTime } from '#tests/support/fixed_clock'
import { FACTORY_PASSPHRASE, UserFactory } from '#tests/factories/user_factory'
import { expectStatus } from '#tests/support/expect_response'
import { PAIRING_CODES, newPairingCode, wrongGuess } from '#tests/support/guardians'

const NOW = '2026-01-05T09:00:00Z'

const REJECTED = {
  message:
    'This sign-up is not possible. Check the pairing code, or sign in if you already have an account',
  code: 'E_GUARDIAN_REGISTRATION_REJECTED',
}

function registerGuardian(
  client: ApiClient,
  code: string,
  email: string,
  extra: Record<string, unknown> = {}
) {
  return client
    .post('/api/v1/auth/register-guardian')
    .json({ code, email, fullName: 'Test guardian', password: FACTORY_PASSPHRASE, ...extra })
    .withCsrfToken()
}

test.group('Guardian registration through a pairing code', (group) => {
  group.each.setup(() => limiter.clear())
  group.each.teardown(() => {
    app.container.restore(Clock)
    env.set('REGISTRATION_OPEN', false)
  })

  test('test_a_pairing_code_opens_registration_even_while_it_is_closed', async ({
    client,
    assert,
  }) => {
    freezeTime(NOW)
    assert.notEqual(env.get('REGISTRATION_OPEN'), true)
    const ward = await UserFactory.create()
    const { code } = await newPairingCode(client, ward)

    const response = await registerGuardian(client, code, 'Guardian-1@example.com', {
      locale: 'es',
      timeZone: 'Europe/Madrid',
    })

    response.assertStatus(201)
    const guardian = await User.findByOrFail('email', 'guardian-1@example.com')
    response.assertSession('auth_web', guardian.id)
    response.assertBodyContains({
      user: {
        guardianOnly: true,
        email: 'guardian-1@example.com',
        locale: 'es',
        isAdmin: false,
        twoFactorEnabled: false,
      },
      link: { role: 'guardian', status: 'pending', counterpart: null },
    })
    assert.isFalse(guardian.isAdmin)
    const link = await GuardianLink.findOrFail(response.body().link.id)
    assert.equal(link.guardianUserId, guardian.id)
    assert.equal(link.status, 'pending')
    const used = await db.from(PAIRING_CODES).where('ward_user_id', ward.id).first()
    assert.equal(used.used_by_user_id, guardian.id)
  })

  test('test_only_a_valid_code_opens_it_and_every_refusal_looks_the_same', async ({
    client,
    assert,
  }) => {
    const ward = await UserFactory.create()
    const { code } = await newPairingCode(client, ward)

    const wrong = await registerGuardian(client, wrongGuess(code), 'wrong@example.com')
    wrong.assertStatus(400)
    wrong.assertBody(REJECTED)

    await expectStatus(registerGuardian(client, code, 'first@example.com'), 201)
    const reused = await registerGuardian(client, code, 'second@example.com')
    reused.assertStatus(400)
    reused.assertBody(REJECTED)

    assert.isNull(await User.findBy('email', 'wrong@example.com'))
    assert.isNull(await User.findBy('email', 'second@example.com'))
  })

  test('test_a_taken_email_is_refused_like_a_wrong_code_and_keeps_the_code', async ({
    client,
    assert,
  }) => {
    const existing = await UserFactory.create()
    const ward = await UserFactory.create()
    const { code } = await newPairingCode(client, ward)

    const response = await registerGuardian(client, code, existing.email.toUpperCase())

    response.assertStatus(400)
    response.assertBody(REJECTED)
    const row = await db.from(PAIRING_CODES).where('ward_user_id', ward.id).first()
    assert.isNull(row.used_at)
    const links = await GuardianLink.query().where('ward_user_id', ward.id)
    assert.lengthOf(links, 0)
  })

  test('test_the_ward_cannot_register_a_second_account_as_guardian_of_self', async ({ client }) => {
    const ward = await UserFactory.create()
    const { code } = await newPairingCode(client, ward)

    const response = await registerGuardian(client, code, ward.email)

    response.assertStatus(400)
    response.assertBody(REJECTED)
  })

  test('test_plain_registration_stays_closed', async ({ client }) => {
    const ward = await UserFactory.create()
    const { code } = await newPairingCode(client, ward)

    const response = await client
      .post('/api/v1/auth/register')
      .json({
        invitation: code,
        email: 'sneaky@example.com',
        fullName: 'X',
        password: FACTORY_PASSPHRASE,
      })
      .withCsrfToken()

    response.assertStatus(400)
    response.assertBodyContains({ code: 'E_REGISTRATION_REJECTED' })
  })

  test('test_registration_guesses_share_the_pairing_throttle_per_ip', async ({ client }) => {
    for (let index = 0; index < 10; index++) {
      await expectStatus(
        registerGuardian(client, `7${String(index).padStart(5, '0')}`, `g${index}@example.com`),
        400
      )
    }

    await expectStatus(registerGuardian(client, '799999', 'late@example.com'), 429)
  })

  test('test_the_password_policy_applies_to_guardians', async ({ client }) => {
    const ward = await UserFactory.create()
    const { code } = await newPairingCode(client, ward)

    await expectStatus(
      registerGuardian(client, code, 'weak@example.com', { password: 'password1234' }),
      422
    )
  })

  test('test_registering_a_guardian_needs_csrf', async ({ client }) => {
    await expectStatus(
      client.post('/api/v1/auth/register-guardian').json({
        code: '123456',
        email: 'x@example.com',
        fullName: 'X',
        password: FACTORY_PASSPHRASE,
      }),
      403
    )
  })
})
