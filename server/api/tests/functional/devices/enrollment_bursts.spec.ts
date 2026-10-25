// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import type { ApiClient, ApiResponse } from '@japa/api-client'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import limiter from '@adonisjs/limiter/services/main'
import { UserFactory } from '#tests/factories/user_factory'
import { ENROLLMENT_CODES_TABLE } from '#services/devices/enrollment_code_service'
import { bootKeys } from '#tests/support/device_api'

/**
 * Concurrent enrolment guesses against the Postgres limiter store
 * (production's). Both locks are charged before a guess is compared: the
 * per-IP failure bucket (10 per 15 minutes) and the code's own attempt
 * counter (5, whatever the IP). A 400 is a refused guess, a 429 never
 * reached the code.
 */
const BURST = 15

function enrol(client: ApiClient, code: string, ip: string) {
  return client
    .post('/api/v1/device/enroll')
    .header('X-Client-Version', 'android/0.1.0')
    .header('x-forwarded-for', ip)
    .json({ code, name: 'Guesser', platform: 'android', clientVersion: '0.1.0' })
}

async function pendingCode(client: ApiClient) {
  const user = await UserFactory.create()
  const response = await client.post('/api/v1/devices/enrollment-codes').actingAs(user)
  response.assertStatus(201)
  return { user, code: response.body().code as string }
}

const count = (responses: ApiResponse[], status: number) =>
  responses.filter((response) => response.status() === status).length

test.group('Enrolment guesses under concurrent bursts (database store)', (group) => {
  group.each.setup(async () => {
    env.set('LIMITER_STORE', 'database')
    await limiter.clear(['database'])
    await bootKeys()
  })
  group.each.teardown(async () => {
    await limiter.clear(['database'])
    env.set('LIMITER_STORE', 'memory')
  })

  test('test_a_burst_from_one_ip_evaluates_at_most_ten_guesses', async ({ client, assert }) => {
    const responses = await Promise.all(
      Array.from({ length: BURST }, (_, index) =>
        enrol(client, `ZZZZZ${'ABCDEFGHIJKLMNOPQRST'[index]}AA`, '198.51.100.20')
      )
    )

    assert.isAtMost(count(responses, 400), 10)
    assert.equal(count(responses, 400) + count(responses, 429), BURST)
  })

  test('test_a_burst_on_one_code_from_many_ips_compares_at_most_five_guesses', async ({
    client,
    assert,
  }) => {
    const { user, code } = await pendingCode(client)
    const lookup = code.slice(0, 3)
    const guesses = Array.from({ length: BURST }, (_, index) => {
      const tail = `${'ABCDEFGHIJKLMNOPQRST'[index]}${'2345'}`
      return lookup + (tail === code.slice(3) ? '77777' : tail)
    })

    const responses = await Promise.all(
      guesses.map((guess, index) => enrol(client, guess, `203.0.113.${index + 1}`))
    )

    assert.equal(count(responses, 400), BURST)
    const row = await db.from(ENROLLMENT_CODES_TABLE).where('user_id', user.id).first()
    assert.equal(row.attempts, 5)
    // Dead: even the right code, from a fresh address, no longer works.
    const right = await enrol(client, code, '203.0.113.200')
    right.assertStatus(400)
    right.assertBody({ code: 'invalid_enrollment_code' })
  })
})
