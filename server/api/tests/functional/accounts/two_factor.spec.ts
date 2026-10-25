// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import User from '#models/user'
import Clock from '#services/clock'
import RecoveryCode from '#models/recovery_code'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import { totpCode } from '#domain/auth/totp'
import { base32Decode } from '#domain/auth/base32'
import { oneWayDigest } from '#domain/accounts/one_way_digest'
import { normalizeRecoveryCode } from '#domain/auth/recovery_code'
import { type FixedClock, freezeTime } from '#tests/support/fixed_clock'
import { FACTORY_PASSPHRASE, UserFactory } from '#tests/factories/user_factory'

/*
 * Requests of one browser session: `.withSession(previous.session())`
 * carries the (server-side) session data of the previous response, which
 * is what the session cookie would carry in a browser.
 */
const NOW = '2026-01-05T09:00:00Z'

/** The code an authenticator app shows for `seed` at the clock's instant. */
function codeAt(seed: string, clock: FixedClock) {
  return totpCode(base32Decode(seed)!, clock.now().toSeconds())
}

/** Enrols and confirms TOTP for `user` through the API; returns the seed and recovery codes. */
async function enableTwoFactor(client: ApiClient, user: User, clock: FixedClock) {
  const enrol = await client
    .post('/api/v1/me/two-factor')
    .json({ password: FACTORY_PASSPHRASE })
    .actingAs(user)
  enrol.assertStatus(200)
  const seed: string = enrol.body().secret

  const confirm = await client
    .post('/api/v1/me/two-factor/confirm')
    .json({ code: codeAt(seed, clock) })
    .actingAs(user)
  confirm.assertStatus(200)
  // Let the next code be a fresh step.
  clock.advance({ seconds: 30 })
  await user.refresh()
  return { seed, recoveryCodes: confirm.body().recoveryCodes as string[] }
}

test.group('Accounts / two-factor enrolment', (group) => {
  group.each.setup(() => limiter.clear())
  group.each.teardown(() => app.container.restore(Clock))

  test('test_enrolment_needs_the_password_and_returns_a_seed_and_otpauth_uri', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()

    const refused = await client
      .post('/api/v1/me/two-factor')
      .json({ password: 'not the right passphrase' })
      .actingAs(user)
    refused.assertStatus(400)
    refused.assertBodyContains({ code: 'E_REAUTH_FAILED' })

    const response = await client
      .post('/api/v1/me/two-factor')
      .json({ password: FACTORY_PASSPHRASE })
      .actingAs(user)

    response.assertStatus(200)
    const { secret, otpauthUrl } = response.body()
    assert.match(secret, /^[A-Z2-7]{32}$/)
    assert.equal(
      otpauthUrl,
      `otpauth://totp/monki-focus:${encodeURIComponent(user.email)}?secret=${secret}&issuer=monki-focus&algorithm=SHA1&digits=6&period=30`
    )

    await user.refresh()
    assert.isFalse(user.twoFactorEnabled, 'not active before the first code')
    assert.isNotNull(user.totpSecretEncrypted)
    assert.notInclude(user.totpSecretEncrypted!, secret, 'the seed is stored encrypted')
  })

  test('test_confirming_activates_totp_returns_ten_hashed_recovery_codes_and_ends_other_sessions', async ({
    client,
    assert,
  }) => {
    const clock = freezeTime(NOW)
    const user = await UserFactory.create()
    const otherDevice = await User.findOrFail(user.id)
    const enrol = await client
      .post('/api/v1/me/two-factor')
      .json({ password: FACTORY_PASSPHRASE })
      .actingAs(user)

    const response = await client
      .post('/api/v1/me/two-factor/confirm')
      .json({ code: codeAt(enrol.body().secret, clock) })
      .actingAs(user)

    response.assertStatus(200)
    const codes: string[] = response.body().recoveryCodes
    assert.lengthOf(codes, 10)
    assert.lengthOf(new Set(codes), 10)
    for (const code of codes) assert.match(code, /^[a-z2-7]{4}(-[a-z2-7]{4}){3}$/)

    const stored = await RecoveryCode.query().where('user_id', user.id)
    assert.sameMembers(
      stored.map((row) => row.codeHash),
      codes.map((code) => oneWayDigest(normalizeRecoveryCode(code)!))
    )
    await user.refresh()
    assert.isTrue(user.twoFactorEnabled)
    response.assertSession('sv', user.sessionVersion)

    const stale = await client.get('/api/v1/auth/me').actingAs(otherDevice)
    stale.assertStatus(401)
    const me = await client.get('/api/v1/auth/me').actingAs(user)
    me.assertBodyContains({ user: { twoFactorEnabled: true } })
  })

  test('test_a_wrong_first_code_does_not_activate_and_is_throttled', async ({ client, assert }) => {
    const user = await UserFactory.create()
    await client.post('/api/v1/me/two-factor').json({ password: FACTORY_PASSPHRASE }).actingAs(user)

    for (let index = 0; index < 5; index++) {
      const response = await client
        .post('/api/v1/me/two-factor/confirm')
        .json({ code: '000000' })
        .actingAs(user)
      // 1 in a million that 000000 is the real code: then the next would be 409.
      response.assertStatus(400)
      response.assertBodyContains({ code: 'E_INVALID_TWO_FACTOR_CODE' })
    }
    const blocked = await client
      .post('/api/v1/me/two-factor/confirm')
      .json({ code: '000000' })
      .actingAs(user)
    blocked.assertStatus(429)

    await user.refresh()
    assert.isFalse(user.twoFactorEnabled)
  })

  test('test_confirm_without_an_enrolment_and_enrol_twice_are_conflicts', async ({ client }) => {
    const clock = freezeTime(NOW)
    const user = await UserFactory.create()

    const nothingPending = await client
      .post('/api/v1/me/two-factor/confirm')
      .json({ code: '123456' })
      .actingAs(user)
    nothingPending.assertStatus(409)
    nothingPending.assertBodyContains({ code: 'E_TWO_FACTOR_NOT_PENDING' })

    await enableTwoFactor(client, user, clock)
    const again = await client
      .post('/api/v1/me/two-factor')
      .json({ password: FACTORY_PASSPHRASE })
      .actingAs(user)
    again.assertStatus(409)
    again.assertBodyContains({ code: 'E_TWO_FACTOR_ALREADY_ENABLED' })
  })

  test('test_turning_totp_off_needs_the_password_and_a_second_factor', async ({
    client,
    assert,
  }) => {
    const clock = freezeTime(NOW)
    const user = await UserFactory.create()
    const { seed } = await enableTwoFactor(client, user, clock)

    const passwordOnly = await client
      .delete('/api/v1/me/two-factor')
      .json({ password: FACTORY_PASSPHRASE })
      .actingAs(user)
    passwordOnly.assertStatus(422)

    const wrongCode = await client
      .delete('/api/v1/me/two-factor')
      .json({ password: FACTORY_PASSPHRASE, code: '000000' })
      .actingAs(user)
    wrongCode.assertStatus(400)

    const response = await client
      .delete('/api/v1/me/two-factor')
      .json({ password: FACTORY_PASSPHRASE, code: codeAt(seed, clock) })
      .actingAs(user)
    response.assertStatus(204)

    await user.refresh()
    assert.isFalse(user.twoFactorEnabled)
    assert.isNull(user.totpSecretEncrypted)
    assert.lengthOf(await RecoveryCode.query().where('user_id', user.id), 0)
  })

  test('test_regenerating_recovery_codes_retires_the_old_ones', async ({ client, assert }) => {
    const clock = freezeTime(NOW)
    const user = await UserFactory.create()
    const { recoveryCodes } = await enableTwoFactor(client, user, clock)

    const response = await client
      .post('/api/v1/me/two-factor/recovery-codes')
      .json({ password: FACTORY_PASSPHRASE, recoveryCode: recoveryCodes[0] })
      .actingAs(user)

    response.assertStatus(200)
    const fresh: string[] = response.body().recoveryCodes
    assert.lengthOf(fresh, 10)
    assert.notIncludeMembers(fresh, recoveryCodes)

    const old = await client
      .delete('/api/v1/me/two-factor')
      .json({ password: FACTORY_PASSPHRASE, recoveryCode: recoveryCodes[1] })
      .actingAs(user)
    old.assertStatus(400)
    old.assertBodyContains({ code: 'E_INVALID_TWO_FACTOR_CODE' })
  })
})

test.group('Accounts / two-factor login', (group) => {
  group.each.setup(() => limiter.clear())
  group.each.teardown(() => app.container.restore(Clock))

  async function passwordStep(client: ApiClient, user: User) {
    const response = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: FACTORY_PASSPHRASE })
      .withCsrfToken()
    response.assertStatus(200)
    return response
  }

  test('test_the_password_step_signs_nobody_in_and_the_code_step_does', async ({
    client,
    assert,
  }) => {
    const clock = freezeTime(NOW)
    const user = await UserFactory.create()
    const { seed } = await enableTwoFactor(client, user, clock)

    const first = await passwordStep(client, user)
    first.assertBody({ twoFactorRequired: true })
    assert.isUndefined(first.session().auth_web)

    const me = await client.get('/api/v1/auth/me').withSession(first.session())
    me.assertStatus(401)

    const second = await client
      .post('/api/v1/auth/two-factor')
      .withSession(first.session())
      .json({ code: codeAt(seed, clock) })
      .withCsrfToken()

    second.assertStatus(200)
    second.assertBodyContains({ user: { id: user.id, twoFactorEnabled: true } })
    second.assertSession('auth_web', user.id)
    second.assertSession('sv', user.sessionVersion)
    assert.isUndefined(second.session().two_factor_challenge)
  })

  test('test_a_code_is_never_accepted_twice', async ({ client }) => {
    const clock = freezeTime(NOW)
    const user = await UserFactory.create()
    const { seed } = await enableTwoFactor(client, user, clock)
    const code = codeAt(seed, clock)

    const first = await passwordStep(client, user)
    const ok = await client
      .post('/api/v1/auth/two-factor')
      .withSession(first.session())
      .json({ code })
      .withCsrfToken()
    ok.assertStatus(200)

    const again = await passwordStep(client, user)
    const replay = await client
      .post('/api/v1/auth/two-factor')
      .withSession(again.session())
      .json({ code })
      .withCsrfToken()
    replay.assertStatus(400)
    replay.assertBodyContains({ code: 'E_INVALID_TWO_FACTOR_CODE' })
  })

  test('test_a_recovery_code_signs_in_once', async ({ client, assert }) => {
    const clock = freezeTime(NOW)
    const user = await UserFactory.create()
    const { recoveryCodes } = await enableTwoFactor(client, user, clock)
    const typed = recoveryCodes[3].toUpperCase().replace(/-/g, ' ')

    const first = await passwordStep(client, user)
    const ok = await client
      .post('/api/v1/auth/two-factor')
      .withSession(first.session())
      .json({ recoveryCode: typed })
      .withCsrfToken()
    ok.assertStatus(200)

    const again = await passwordStep(client, user)
    const reused = await client
      .post('/api/v1/auth/two-factor')
      .withSession(again.session())
      .json({ recoveryCode: typed })
      .withCsrfToken()
    reused.assertStatus(400)

    const unused = await RecoveryCode.query().where('user_id', user.id).whereNull('used_at')
    assert.lengthOf(unused, 9)
  })

  test('test_the_code_step_expires_after_five_minutes', async ({ client }) => {
    const clock = freezeTime(NOW)
    const user = await UserFactory.create()
    const { seed } = await enableTwoFactor(client, user, clock)

    const first = await passwordStep(client, user)
    clock.advance({ minutes: 5 })
    const late = await client
      .post('/api/v1/auth/two-factor')
      .withSession(first.session())
      .json({ code: codeAt(seed, clock) })
      .withCsrfToken()

    late.assertStatus(400)
    late.assertBodyContains({ code: 'E_TWO_FACTOR_CHALLENGE_EXPIRED' })
  })

  test('test_the_code_step_without_a_password_step_is_refused', async ({ client }) => {
    const response = await client
      .post('/api/v1/auth/two-factor')
      .json({ code: '123456' })
      .withCsrfToken()

    response.assertStatus(400)
    response.assertBodyContains({ code: 'E_TWO_FACTOR_CHALLENGE_EXPIRED' })
  })

  test('test_wrong_codes_at_login_are_throttled_per_user', async ({ client }) => {
    const clock = freezeTime(NOW)
    const user = await UserFactory.create()
    const { seed } = await enableTwoFactor(client, user, clock)
    const first = await passwordStep(client, user)
    const attempt = (code: string) =>
      client
        .post('/api/v1/auth/two-factor')
        .withSession(first.session())
        .json({ code })
        .withCsrfToken()

    for (let index = 0; index < 5; index++) {
      const response = await attempt('000000')
      response.assertStatus(400)
    }
    const blocked = await attempt(codeAt(seed, clock))
    blocked.assertStatus(429)
  })
})
