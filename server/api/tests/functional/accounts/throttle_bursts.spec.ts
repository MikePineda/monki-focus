// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import type { ApiResponse } from '@japa/api-client'
import env from '#start/env'
import Clock from '#services/clock'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import { freezeTime } from '#tests/support/fixed_clock'
import { TWO_FACTOR_CHALLENGE_KEY } from '#services/accounts/two_factor_challenge'
import { FACTORY_PASSPHRASE, UserFactory } from '#tests/factories/user_factory'

/**
 * Concurrent bursts against the Postgres limiter store (production's): the
 * buckets are charged atomically before the check runs, so however the
 * requests interleave, no more attempts are evaluated than the limit allows.
 * A 400 is an evaluated (and failed) attempt; a 429 never reached the check.
 */
const BURST = 15

function evaluated(responses: ApiResponse[]) {
  return responses.filter((response) => response.status() === 400).length
}

function refused(responses: ApiResponse[]) {
  return responses.filter((response) => response.status() === 429).length
}

test.group('Failure throttles under concurrent bursts (database store)', (group) => {
  group.each.setup(async () => {
    env.set('LIMITER_STORE', 'database')
    await limiter.clear(['database'])
  })
  group.each.teardown(async () => {
    await limiter.clear(['database'])
    env.set('LIMITER_STORE', 'memory')
    app.container.restore(Clock)
  })

  test('test_a_login_burst_evaluates_at_most_five_passwords', async ({ client, assert }) => {
    const user = await UserFactory.create()

    const responses = await Promise.all(
      Array.from({ length: BURST }, () =>
        client
          .post('/api/v1/auth/login')
          .json({ email: user.email, password: 'not the right passphrase' })
          .withCsrfToken()
      )
    )

    assert.isAtMost(evaluated(responses), 5)
    assert.equal(evaluated(responses) + refused(responses), BURST)
    // Blocked now: even the right password is not checked.
    const after = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: FACTORY_PASSPHRASE })
      .withCsrfToken()
    after.assertStatus(429)
  })

  test('test_a_two_factor_burst_evaluates_at_most_five_codes', async ({ client, assert }) => {
    const clock = freezeTime('2026-01-05T09:00:00Z')
    const user = await UserFactory.merge({ totpSecretEncrypted: 'opaque' }).create()
    user.totpEnabledAt = clock.now()
    await user.save()
    // The password step, as it leaves the session.
    const session = {
      [TWO_FACTOR_CHALLENGE_KEY]: {
        userId: user.id,
        sv: user.sessionVersion,
        expiresAt: clock.now().plus({ minutes: 5 }).toMillis(),
      },
    }

    const responses = await Promise.all(
      Array.from({ length: BURST }, () =>
        client
          .post('/api/v1/auth/two-factor')
          .withSession(session)
          .json({ code: '000000' })
          .withCsrfToken()
      )
    )

    assert.isAtMost(evaluated(responses), 5)
    assert.equal(evaluated(responses) + refused(responses), BURST)
  })

  test('test_a_password_recheck_burst_evaluates_at_most_five_passwords', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()

    const responses = await Promise.all(
      Array.from({ length: BURST }, () =>
        client
          .put('/api/v1/me/password')
          .json({ currentPassword: 'not the right passphrase', password: 'violet glacier tram 31' })
          .actingAs(user)
      )
    )

    assert.isAtMost(evaluated(responses), 5)
    assert.equal(evaluated(responses) + refused(responses), BURST)
  })

  test('test_an_invitation_guessing_burst_evaluates_at_most_ten_links', async ({
    client,
    assert,
  }) => {
    const responses = await Promise.all(
      Array.from({ length: BURST + 5 }, (_, index) =>
        client
          .post('/api/v1/auth/register')
          .json({
            invitation: `guess-${index}`,
            email: `guess-${index}@example.com`,
            fullName: 'Guesser',
            password: 'quartz pebble harbor 7',
          })
          .withCsrfToken()
      )
    )

    assert.isAtMost(evaluated(responses), 10)
    assert.equal(evaluated(responses) + refused(responses), BURST + 5)
  })

  test('test_a_success_refunds_the_ip_bucket_and_clears_the_account_bucket', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const attempt = (password: string) =>
      client.post('/api/v1/auth/login').json({ email: user.email, password }).withCsrfToken()

    for (let index = 0; index < 4; index++) await attempt('not the right passphrase')
    const success = await attempt(FACTORY_PASSPHRASE)
    success.assertStatus(200)

    // The account bucket starts over: five more failures are evaluated.
    const after = []
    for (let index = 0; index < 5; index++) after.push(await attempt('not the right passphrase'))
    assert.equal(evaluated(after), 5)
  })
})
