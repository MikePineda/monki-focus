// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import Clock from '#services/clock'
import GuardianLink from '#models/guardian_link'
import { freezeTime } from '#tests/support/fixed_clock'
import { FACTORY_PASSPHRASE, UserFactory } from '#tests/factories/user_factory'
import { guardianPair } from '#tests/factories/guardian_link_factory'
import { expectStatus } from '#tests/support/expect_response'
import { WardRevocationJob } from '#scheduler/ward_revocation_job'
import { newPairingCode, redeem } from '#tests/support/guardians'

const NOW = '2026-01-05T09:00:00Z'

/**
 * Until the ward confirms them, whoever redeemed a pairing code learns
 * nothing about the ward (a guessed or leaked code must not reveal whose it
 * was), and a pending link the ward never confirms lapses after 24 hours.
 */
test.group('Pending guardian links', (group) => {
  group.each.setup(() => limiter.clear())
  group.each.teardown(() => app.container.restore(Clock))

  test('test_a_pending_guardian_never_learns_who_the_ward_is', async ({ client, assert }) => {
    const ward = await UserFactory.create()
    const guardian = await UserFactory.apply('twoFactor').create()
    const { code } = await newPairingCode(client, ward)

    const redeemed = await redeem(client, guardian, code)
    const listed = await client.get('/api/v1/guardian/links').actingAs(guardian)

    for (const link of [redeemed.body().link, listed.body().links[0]]) {
      assert.equal(link.status, 'pending')
      assert.isNull(link.counterpart)
      assert.notProperty(link, 'wardUserId')
    }
    for (const response of [redeemed, listed]) {
      const text = JSON.stringify(response.body())
      assert.notInclude(text, ward.email)
      assert.notInclude(text, ward.fullName!)
    }
  })

  test('test_a_new_guardian_account_never_learns_who_the_ward_is', async ({ client, assert }) => {
    const ward = await UserFactory.create()
    const { code } = await newPairingCode(client, ward)

    const response = await client
      .post('/api/v1/auth/register-guardian')
      .json({
        code,
        email: 'pending-guardian@example.com',
        fullName: 'Pending guardian',
        password: FACTORY_PASSPHRASE,
      })
      .withCsrfToken()

    response.assertStatus(201)
    assert.isNull(response.body().link.counterpart)
    assert.notProperty(response.body().link, 'wardUserId')
    assert.notInclude(JSON.stringify(response.body()), ward.email)
  })

  test('test_the_ward_still_sees_who_asks_to_be_their_guardian', async ({ client, assert }) => {
    const { ward, guardian } = await guardianPair({ state: 'pending' })

    const listed = await client.get('/api/v1/guardian/links').actingAs(ward)

    assert.deepEqual(listed.body().links[0].counterpart, {
      email: guardian.email,
      fullName: guardian.fullName,
    })
  })

  test('test_the_guardian_learns_the_ward_once_confirmed', async ({ client, assert }) => {
    const { ward, guardian, link } = await guardianPair({ state: 'pending' })
    await expectStatus(
      client
        .post(`/api/v1/guardian/links/${link.id}/confirm`)
        .json({ password: FACTORY_PASSPHRASE })
        .actingAs(ward),
      200
    )

    const listed = await client.get('/api/v1/guardian/links').actingAs(guardian)

    assert.equal(listed.body().links[0].wardUserId, ward.id)
    assert.deepEqual(listed.body().links[0].counterpart, {
      email: ward.email,
      fullName: ward.fullName,
    })
  })

  test('test_a_declined_link_in_the_guardians_export_names_nobody', async ({ client, assert }) => {
    const { ward, guardian, link } = await guardianPair({ state: 'pending' })
    await expectStatus(client.post(`/api/v1/guardian/links/${link.id}/revoke`).actingAs(ward), 204)

    const exported = await client.get('/api/v1/me/export').actingAs(guardian)

    const [entry] = exported.body().guardianLinks
    assert.equal(entry.role, 'guardian')
    assert.isNull(entry.counterpart)
    assert.notProperty(entry, 'wardUserId')
    assert.notInclude(JSON.stringify(exported.body()), ward.email)
  })

  test('test_a_pending_link_lapses_after_24_hours', async ({ client, assert }) => {
    const clock = freezeTime(NOW)
    const ward = await UserFactory.create()
    const guardian = await UserFactory.apply('twoFactor').create()
    const { code } = await newPairingCode(client, ward)
    const redeemed = await redeem(client, guardian, code)
    const { link } = redeemed.body() as { link: { id: number } }

    clock.advance({ hours: 23, minutes: 59 })
    const before = await client.get('/api/v1/guardian/links').actingAs(ward)
    assert.lengthOf(before.body().links, 1)

    clock.advance({ minutes: 1 })
    const after = await client.get('/api/v1/guardian/links').actingAs(ward)
    assert.deepEqual(after.body().links, [])
    await expectStatus(
      client
        .post(`/api/v1/guardian/links/${link.id}/confirm`)
        .json({ password: FACTORY_PASSPHRASE })
        .actingAs(ward),
      404
    )

    await new WardRevocationJob().finalizeDue(clock.now())
    const row = await GuardianLink.findOrFail(link.id)
    assert.equal(row.status, 'revoked')
    assert.equal(row.revokedAt?.toUTC().toISO(), '2026-01-06T09:00:00.000Z')
    assert.isNull(row.revokedByUserId)
  })

  test('test_the_pair_can_pair_again_as_soon_as_a_pending_link_lapsed', async ({ client }) => {
    const clock = freezeTime(NOW)
    const { ward, guardian, link } = await guardianPair({ state: 'pending' })
    link.createdAt = DateTime.fromISO(NOW, { zone: 'utc' })
    await link.save()
    clock.advance({ hours: 25 })
    const { code } = await newPairingCode(client, ward)

    await expectStatus(redeem(client, guardian, code), 201)
  })
})
