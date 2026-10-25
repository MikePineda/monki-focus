// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import Clock from '#services/clock'
import User from '#models/user'
import GuardianLink from '#models/guardian_link'
import { freezeTime } from '#tests/support/fixed_clock'
import { base32Decode } from '#domain/auth/base32'
import { totpCode } from '#domain/auth/totp'
import { FACTORY_PASSPHRASE, UserFactory } from '#tests/factories/user_factory'
import { guardianPair } from '#tests/factories/guardian_link_factory'
import { expectStatus } from '#tests/support/expect_response'
import { guardianEventLog, newPairingCode, noticesFor } from '#tests/support/guardians'

const NOW = '2026-01-05T09:00:00Z'

function deleteAccount(client: ApiClient, user: User) {
  return client.delete('/api/v1/me').json({ password: FACTORY_PASSPHRASE }).actingAs(user)
}

test.group('Guardian links and accounts', (group) => {
  group.each.setup(() => limiter.clear())
  group.each.teardown(() => app.container.restore(Clock))

  test('test_a_new_person_becomes_guardian_with_a_code_and_two_step_verification', async ({
    client,
    assert,
  }) => {
    const clock = freezeTime(NOW)
    const ward = await UserFactory.create()
    const { code } = await newPairingCode(client, ward)

    const registered = await client
      .post('/api/v1/auth/register-guardian')
      .json({
        code,
        email: 'guardian@example.com',
        fullName: 'Guardian',
        password: FACTORY_PASSPHRASE,
      })
      .withCsrfToken()
    registered.assertStatus(201)
    const linkId = registered.body().link.id
    const guardian = await User.findByOrFail('email', 'guardian@example.com')

    // The ward cannot activate it before the guardian has a second factor.
    const early = await client
      .post(`/api/v1/guardian/links/${linkId}/confirm`)
      .json({ password: FACTORY_PASSPHRASE })
      .actingAs(ward)
    early.assertStatus(409)

    // The guardian turns two-step verification on with the regular flow.
    const begun = await client
      .post('/api/v1/me/two-factor')
      .json({ password: FACTORY_PASSPHRASE })
      .actingAs(guardian)
    begun.assertStatus(200)
    const seed = base32Decode(begun.body().secret)!
    await guardian.refresh()
    const confirmed = await client
      .post('/api/v1/me/two-factor/confirm')
      .json({ code: totpCode(seed, clock.now().toSeconds()) })
      .actingAs(guardian)
    confirmed.assertStatus(200)
    await guardian.refresh()

    const activated = await client
      .post(`/api/v1/guardian/links/${linkId}/confirm`)
      .json({ password: FACTORY_PASSPHRASE })
      .actingAs(ward)
    activated.assertStatus(200)
    assert.equal(activated.body().link.status, 'active')
    await expectStatus(
      client.get(`/api/v1/guardian/wards/${ward.id}/summary`).actingAs(guardian),
      200
    )
  })

  test('test_deleting_a_ward_account_tells_each_guardian_neutrally', async ({ client, assert }) => {
    freezeTime(NOW)
    const { ward, guardian, link } = await guardianPair({ state: 'active' })
    const second = await guardianPair({ state: 'revoking', ward })
    const pending = await guardianPair({ state: 'pending', ward })

    await expectStatus(deleteAccount(client, ward), 204)

    assert.isNull(await User.find(ward.id))
    assert.isNull(await GuardianLink.find(link.id))
    for (const [who, topic] of [
      [guardian, link.ntfyTopic],
      [second.guardian, second.link.ntfyTopic],
    ] as const) {
      const notices = await noticesFor(who)
      assert.lengthOf(notices, 1)
      assert.equal(notices[0].topic, topic)
      assert.deepEqual(notices[0].payload, {
        type: 'guardian_notice',
        kind: 'pairing_ended',
        linkId: (topic === link.ntfyTopic ? link : second.link).id,
      })
    }
    assert.lengthOf(await noticesFor(pending.guardian), 0, 'a pending link granted nothing')
  })

  test('test_deleting_a_guardian_account_is_recorded_for_the_ward', async ({ client, assert }) => {
    const { ward, guardian } = await guardianPair({ state: 'active' })

    await expectStatus(deleteAccount(client, guardian), 204)

    assert.deepEqual(await guardianEventLog(ward), [
      ['guardian_unlinked', { endedBy: 'guardian', reason: 'account_deleted' }],
    ])
  })

  test('test_the_export_lists_guardian_links_without_their_topic', async ({ client, assert }) => {
    const { ward, guardian, link } = await guardianPair({ state: 'active' })
    await guardianPair({ state: 'revoked', ward })

    const exported = await client.get('/api/v1/me/export').actingAs(ward)
    const guardianExport = await client.get('/api/v1/me/export').actingAs(guardian)

    exported.assertStatus(200)
    const links = exported.body().guardianLinks
    assert.lengthOf(links, 2, 'revoked links are part of the user’s history')
    assert.deepEqual(
      links.map((entry: { role: string }) => entry.role),
      ['ward', 'ward']
    )
    assert.equal(guardianExport.body().guardianLinks[0].role, 'guardian')
    assert.notInclude(JSON.stringify(exported.body()), link.ntfyTopic)
    assert.notInclude(JSON.stringify(guardianExport.body()), link.ntfyTopic)
  })
})
