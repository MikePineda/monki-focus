// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import User from '#models/user'
import limiter from '@adonisjs/limiter/services/main'
import { FACTORY_PASSPHRASE, UserFactory } from '#tests/factories/user_factory'
import { revokeSessions } from '#services/accounts/session_revocation'

const SESSION_COOKIE = 'mf_session'

test.group('Accounts / login and sessions', (group) => {
  group.each.setup(() => limiter.clear())

  test('test_login_starts_a_session_stamped_with_the_session_version', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.merge({ sessionVersion: 3 }).create()

    const response = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email.toUpperCase(), password: FACTORY_PASSPHRASE })
      .withCsrfToken()

    response.assertStatus(200)
    response.assertBodyContains({
      twoFactorRequired: false,
      user: { id: user.id, email: user.email, isAdmin: false, twoFactorEnabled: false },
    })
    response.assertSession('auth_web', user.id)
    response.assertSession('sv', 3)
    assert.exists(response.cookie(SESSION_COOKIE))
    for (const field of ['password', 'sessionVersion', 'totpSecretEncrypted', 'ntfyTopic']) {
      assert.notProperty(response.body().user, field)
    }
  })

  test('test_a_wrong_password_and_an_unknown_email_answer_the_same', async ({ client }) => {
    const user = await UserFactory.create()

    const wrongPassword = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: 'not the right passphrase' })
      .withCsrfToken()
    const unknownEmail = await client
      .post('/api/v1/auth/login')
      .json({ email: 'nobody-here@example.com', password: 'not the right passphrase' })
      .withCsrfToken()

    wrongPassword.assertStatus(400)
    unknownEmail.assertStatus(400)
    wrongPassword.assertBody({
      message: 'The email or the password is not correct',
      code: 'E_INVALID_CREDENTIALS',
    })
    unknownEmail.assertBody(wrongPassword.body())
  })

  test('test_login_errors_are_translated', async ({ client }) => {
    const response = await client
      .post('/api/v1/auth/login')
      .header('accept-language', 'es')
      .json({ email: 'nobody-here@example.com', password: 'not the right passphrase' })
      .withCsrfToken()

    response.assertStatus(400)
    response.assertBody({
      message: 'El correo o la contraseña no son correctos',
      code: 'E_INVALID_CREDENTIALS',
    })
  })

  test('test_login_is_throttled_after_five_failures_for_an_email', async ({ client }) => {
    const user = await UserFactory.create()
    const attempt = (password: string) =>
      client.post('/api/v1/auth/login').json({ email: user.email, password }).withCsrfToken()

    for (let index = 0; index < 5; index++) {
      const response = await attempt('not the right passphrase')
      response.assertStatus(400)
    }

    // Blocked: even the right password is refused without being checked.
    const blocked = await attempt(FACTORY_PASSPHRASE)
    blocked.assertStatus(429)
  })

  test('test_the_email_block_does_not_lock_out_another_client_ip', async ({ client }) => {
    const user = await UserFactory.create()
    const attempt = (ip: string, password: string) =>
      client
        .post('/api/v1/auth/login')
        .header('x-forwarded-for', ip)
        .json({ email: user.email, password })
        .withCsrfToken()

    for (let index = 0; index < 5; index++) {
      const response = await attempt('203.0.113.10', 'not the right passphrase')
      response.assertStatus(400)
    }

    const sameIp = await attempt('203.0.113.10', FACTORY_PASSPHRASE)
    sameIp.assertStatus(429)
    const otherIp = await attempt('203.0.113.11', FACTORY_PASSPHRASE)
    otherIp.assertStatus(200)
  })

  test('test_a_successful_login_resets_the_per_email_counter', async ({ client }) => {
    const user = await UserFactory.create()
    const attempt = (password: string) =>
      client.post('/api/v1/auth/login').json({ email: user.email, password }).withCsrfToken()

    for (let index = 0; index < 4; index++) await attempt('not the right passphrase')
    const success = await attempt(FACTORY_PASSPHRASE)
    success.assertStatus(200)

    for (let index = 0; index < 4; index++) {
      const response = await attempt('not the right passphrase')
      response.assertStatus(400)
    }
  })

  test('test_one_ip_guessing_many_emails_is_throttled', async ({ client }) => {
    for (let index = 0; index < 30; index++) {
      const response = await client
        .post('/api/v1/auth/login')
        .header('x-forwarded-for', '198.51.100.7')
        .json({ email: `guess-${index}@example.com`, password: 'not the right passphrase' })
        .withCsrfToken()
      response.assertStatus(400)
    }

    const blocked = await client
      .post('/api/v1/auth/login')
      .header('x-forwarded-for', '198.51.100.7')
      .json({ email: 'guess-final@example.com', password: 'not the right passphrase' })
      .withCsrfToken()
    blocked.assertStatus(429)
  })

  test('test_login_without_csrf_is_rejected', async ({ client }) => {
    const user = await UserFactory.create()

    const response = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: FACTORY_PASSPHRASE })

    response.assertStatus(403)
    response.assertBodyContains({ code: 'E_BAD_CSRF_TOKEN' })
  })

  test('test_login_validates_its_payload', async ({ client }) => {
    const response = await client
      .post('/api/v1/auth/login')
      .json({ email: 'not-an-email', password: 'x'.repeat(129) })
      .withCsrfToken()

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        { field: 'email', rule: 'email' },
        { field: 'password', rule: 'maxLength' },
      ],
    })
  })

  test('test_me_returns_the_signed_in_user', async ({ client }) => {
    const user = await UserFactory.merge({ timeZone: 'Europe/Madrid', weekStart: 7 }).create()

    const response = await client.get('/api/v1/auth/me').actingAs(user)

    response.assertStatus(200)
    response.assertBody({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        locale: 'en',
        timeZone: 'Europe/Madrid',
        weekStart: 7,
        isAdmin: false,
        twoFactorEnabled: false,
        createdAt: user.createdAt.toUTC().toISO(),
      },
    })
  })

  test('test_a_guest_gets_401_with_the_error_envelope', async ({ client }) => {
    const response = await client.get('/api/v1/auth/me')

    response.assertStatus(401)
    response.assertBody({ message: 'Sign in to continue', code: 'E_UNAUTHORIZED_ACCESS' })
  })

  test('test_a_session_without_a_version_stamp_is_rejected', async ({ client }) => {
    const user = await UserFactory.create()

    const response = await client.get('/api/v1/auth/me').loginAs(user)

    response.assertStatus(401)
    response.assertBodyContains({ code: 'E_UNAUTHORIZED_ACCESS' })
  })

  test('test_logout_ends_the_session_and_any_copy_of_its_cookie', async ({ client, assert }) => {
    const user = await UserFactory.create()
    // A copy of the same cookie (another tab, or a stolen one): same stamp.
    const copy = await User.findOrFail(user.id)

    const response = await client.post('/api/v1/auth/logout').actingAs(user)

    response.assertStatus(204)
    assert.isUndefined(response.session().auth_web)
    await user.refresh()
    assert.equal(user.sessionVersion, 1)
    const replayed = await client.get('/api/v1/auth/me').actingAs(copy)
    replayed.assertStatus(401)
  })

  test('test_concurrent_revocations_never_lose_a_bump', async ({ assert }) => {
    const user = await UserFactory.create()
    // Three requests that each loaded the user at version 0.
    const copies = await Promise.all([1, 2, 3].map(() => User.findOrFail(user.id)))

    await Promise.all(copies.map((copy) => revokeSessions(copy)))

    await user.refresh()
    assert.equal(user.sessionVersion, 3)
    // Each caller reloaded a version at least as new as its own bump.
    for (const copy of copies) assert.isAtLeast(copy.sessionVersion, 1)
  })

  test('test_logout_everywhere_revokes_every_older_session', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const staleCopy = await User.findOrFail(user.id)

    const response = await client.post('/api/v1/auth/logout-everywhere').actingAs(user)
    response.assertStatus(204)

    await user.refresh()
    assert.equal(user.sessionVersion, 1)
    // A session stamped with the old version (another device) is now dead.
    const otherDevice = await client.get('/api/v1/auth/me').actingAs(staleCopy)
    otherDevice.assertStatus(401)
    const fresh = await client.get('/api/v1/auth/me').actingAs(user)
    fresh.assertStatus(200)
  })

  test('test_the_signed_in_user_language_wins_over_accept_language', async ({ client }) => {
    const user = await UserFactory.apply('spanish').create()

    const response = await client
      .get('/api/v1/auth/me')
      .header('accept-language', 'en')
      .actingAs(user)

    response.assertStatus(200)
    response.assertHeader('content-language', 'es')
  })
})
