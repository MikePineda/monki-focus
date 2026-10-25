// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import Clock from '#services/clock'
import { base32Decode } from '#domain/auth/base32'
import { totpCode } from '#domain/auth/totp'
import { freezeTime } from '#tests/support/fixed_clock'
import { FACTORY_PASSPHRASE, UserFactory } from '#tests/factories/user_factory'
import { guardianPair } from '#tests/factories/guardian_link_factory'
import { expectStatus } from '#tests/support/expect_response'
import { captureSql, firstIndex } from '#tests/support/sql_capture'
import { newPairingCode, redeem } from '#tests/support/guardians'

const USERS = /\bfrom "?users"?/
const CODES = /\bfrom "?pairing_codes"?/
const LINKS = /\bfrom "?guardian_links"?/
const FOR_UPDATE = /\bfor update\b/
const FOR_KEY_SHARE = /\bfor key share\b/
const FOR_NO_KEY_UPDATE = /\bfor no key update\b/

/**
 * Lock order across the guardian flows: the users rows first (in id
 * order), then links, then codes, so pairing and account deletion (which
 * cascades from the users row to links and codes) can never wait on each
 * other in a cycle. Concurrency cannot deadlock inside the suite's single
 * transaction, so these specs read the order the statements take locks in.
 */
test.group('Guardian lock order', (group) => {
  group.each.setup(() => limiter.clear())
  group.each.teardown(() => app.container.restore(Clock))

  test('test_redeeming_a_code_locks_the_users_before_the_code', async ({ client, assert }) => {
    const ward = await UserFactory.create()
    const guardian = await UserFactory.create()
    const { code } = await newPairingCode(client, ward)

    const sql = await captureSql(() => expectStatus(redeem(client, guardian, code), 201))

    const users = firstIndex(sql, USERS, FOR_KEY_SHARE)
    const codeLock = firstIndex(sql, CODES, FOR_UPDATE)
    assert.isAtLeast(users, 0, 'the users rows are locked')
    assert.isAbove(codeLock, users, 'the code is locked after the users')
  })

  test('test_registering_through_a_code_locks_the_ward_before_the_code', async ({
    client,
    assert,
  }) => {
    const ward = await UserFactory.create()
    const { code } = await newPairingCode(client, ward)

    const sql = await captureSql(() =>
      expectStatus(
        client
          .post('/api/v1/auth/register-guardian')
          .json({ code, email: 'order@example.com', fullName: 'G', password: FACTORY_PASSPHRASE })
          .withCsrfToken(),
        201
      )
    )

    const users = firstIndex(sql, USERS, FOR_KEY_SHARE)
    assert.isAtLeast(users, 0)
    assert.isAbove(firstIndex(sql, CODES, FOR_UPDATE), users)
  })

  test('test_account_deletion_locks_the_users_first_and_the_links_in_one_ordered_query', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.apply('twoFactor').create()
    await guardianPair({ state: 'active', ward: user })
    await guardianPair({ state: 'active', guardian: user })

    const sql = await captureSql(() =>
      expectStatus(
        client.delete('/api/v1/me').json({ password: FACTORY_PASSPHRASE }).actingAs(user),
        204
      )
    )

    const self = firstIndex(sql, USERS, FOR_UPDATE)
    const linkLocks = sql.filter((statement) => LINKS.test(statement) && FOR_UPDATE.test(statement))
    assert.isAtLeast(self, 0, 'the account row is locked')
    assert.lengthOf(linkLocks, 1, 'both sides of the links are locked by one statement')
    assert.match(linkLocks[0], /order by "?id"?/)
    assert.isAbove(firstIndex(sql, LINKS, FOR_UPDATE), self)
  })

  test('test_confirming_a_link_locks_the_users_before_the_link', async ({ client, assert }) => {
    const { ward, link } = await guardianPair({ state: 'pending' })

    const sql = await captureSql(() =>
      expectStatus(
        client
          .post(`/api/v1/guardian/links/${link.id}/confirm`)
          .json({ password: FACTORY_PASSPHRASE })
          .actingAs(ward),
        200
      )
    )

    const users = firstIndex(sql, USERS, FOR_NO_KEY_UPDATE)
    assert.isAtLeast(users, 0, "the guardian's row is locked, like disabling two-factor does")
    assert.isAbove(firstIndex(sql, LINKS, FOR_UPDATE), users)
  })

  test('test_disabling_two_factor_checks_guardianship_under_the_users_row_lock', async ({
    client,
    assert,
  }) => {
    const clock = freezeTime('2026-01-05T09:00:00Z')
    const user = await UserFactory.create()
    const begun = await client
      .post('/api/v1/me/two-factor')
      .json({ password: FACTORY_PASSPHRASE })
      .actingAs(user)
    const seed = base32Decode(begun.body().secret)!
    await expectStatus(
      client
        .post('/api/v1/me/two-factor/confirm')
        .json({ code: totpCode(seed, clock.now().toSeconds()) })
        .actingAs(user),
      200
    )
    await user.refresh()
    clock.advance({ seconds: 30 })

    const sql = await captureSql(() =>
      expectStatus(
        client
          .delete('/api/v1/me/two-factor')
          .json({ password: FACTORY_PASSPHRASE, code: totpCode(seed, clock.now().toSeconds()) })
          .actingAs(user),
        204
      )
    )

    const lock = firstIndex(sql, USERS, FOR_NO_KEY_UPDATE)
    const disable = firstIndex(sql, /^update "?users"?/, /totp_secret_encrypted/)
    assert.isAtLeast(lock, 0, 'the users row is locked')
    const lockedCheck = sql.findIndex((statement, index) => index > lock && LINKS.test(statement))
    assert.isAbove(lockedCheck, lock, 'guardianship is read again under the lock')
    assert.isAbove(disable, lockedCheck)
  })
})
