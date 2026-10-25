// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import { DateTime } from 'luxon'
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import Clock from '#services/clock'
import GuardianLink from '#models/guardian_link'
import { freezeTime } from '#tests/support/fixed_clock'
import { FACTORY_PASSPHRASE, UserFactory } from '#tests/factories/user_factory'
import { guardianPair } from '#tests/factories/guardian_link_factory'
import { expectStatus } from '#tests/support/expect_response'
import { unsetEnv } from '#tests/support/env_override'
import { BypassAlerts, fakeBypassAlerts } from '#tests/support/device_api'
import { guardianEventsOf, newPairingCode, redeem } from '#tests/support/guardians'

const NOW = '2026-01-05T09:00:00Z'

function confirm(client: ApiClient, linkId: number, password = FACTORY_PASSPHRASE) {
  return client.post(`/api/v1/guardian/links/${linkId}/confirm`).json({ password })
}

test.group('Guardian links', (group) => {
  group.each.setup(() => limiter.clear())
  group.each.teardown(() => {
    app.container.restore(Clock)
    app.container.restore(BypassAlerts)
  })

  test('test_links_are_listed_for_both_sides_and_never_carry_the_topic', async ({
    client,
    assert,
  }) => {
    const { ward, guardian, link } = await guardianPair({ state: 'active' })
    const other = await guardianPair({ state: 'pending', ward: guardian })
    await guardianPair({ state: 'revoked', ward })

    const asWard = await client.get('/api/v1/guardian/links').actingAs(ward)
    const asGuardian = await client.get('/api/v1/guardian/links').actingAs(guardian)

    asWard.assertStatus(200)
    assert.lengthOf(asWard.body().links, 1, 'revoked links are not listed')
    assert.deepEqual(asWard.body().links[0], {
      id: link.id,
      role: 'ward',
      status: 'active',
      wardUserId: ward.id,
      counterpart: { email: guardian.email, fullName: guardian.fullName },
      guardianTwoFactorEnabled: true,
      maxUnlockMinutes: 30,
      allowNotificationActions: true,
      confirmedAt: link.confirmedAt!.toUTC().toISO(),
      revocationRequestedAt: null,
      revocationEffectiveAt: null,
      createdAt: link.createdAt.toUTC().toISO(),
    })
    const roles = asGuardian
      .body()
      .links.map((entry: { role: string; id: number }) => [entry.id, entry.role])
    assert.sameDeepMembers(roles, [
      [link.id, 'guardian'],
      [other.link.id, 'ward'],
    ])
    for (const response of [asWard, asGuardian]) {
      assert.notInclude(JSON.stringify(response.body()), link.ntfyTopic)
      assert.notInclude(JSON.stringify(response.body()), 'mf-')
    }
  })

  test('test_pairing_requires_monitored_device_confirmation', async ({ client, assert }) => {
    freezeTime(NOW)
    const alerts = fakeBypassAlerts()
    const ward = await UserFactory.create()
    const guardian = await UserFactory.apply('twoFactor').create()
    const { code } = await newPairingCode(client, ward)
    const redeemed = await redeem(client, guardian, code)
    const { link } = redeemed.body()

    // Pending: the guardian reaches nothing yet.
    await expectStatus(
      client.get(`/api/v1/guardian/wards/${ward.id}/summary`).actingAs(guardian),
      404
    )

    const response = await confirm(client, link.id).actingAs(ward)

    response.assertStatus(200)
    assert.equal(response.body().link.status, 'active')
    assert.equal(response.body().link.confirmedAt, '2026-01-05T09:00:00.000Z')
    await expectStatus(
      client.get(`/api/v1/guardian/wards/${ward.id}/summary`).actingAs(guardian),
      200
    )
    const events = await guardianEventsOf(ward)
    assert.deepEqual(
      events.map((event) => [event.kind, event.source, event.dedupe_key, event.details]),
      [['guardian_linked', 'server', `s:guardian_linked:${link.id}`, {}]]
    )
    assert.include(alerts.kinds(), 'guardian_linked')
  })

  test('test_confirming_needs_the_wards_password', async ({ client, assert }) => {
    const { ward, link } = await guardianPair({ state: 'pending' })

    const response = await confirm(client, link.id, 'not the password at all').actingAs(ward)

    response.assertStatus(400)
    response.assertBodyContains({ code: 'E_REAUTH_FAILED' })
    await link.refresh()
    assert.equal(link.status, 'pending')
  })

  test('test_link_needs_the_guardians_two_factor_before_it_is_active', async ({
    client,
    assert,
  }) => {
    const { ward, link } = await guardianPair({ state: 'pending', guardianTwoFactor: false })

    const listed = await client.get('/api/v1/guardian/links').actingAs(ward)
    assert.isFalse(listed.body().links[0].guardianTwoFactorEnabled)
    const response = await confirm(client, link.id).actingAs(ward)

    response.assertStatus(409)
    response.assertBodyContains({ code: 'E_GUARDIAN_TWO_FACTOR_REQUIRED' })
    await link.refresh()
    assert.equal(link.status, 'pending')
  })

  test('test_only_the_ward_confirms_and_only_a_pending_link', async ({ client }) => {
    const pending = await guardianPair({ state: 'pending' })
    const active = await guardianPair({ state: 'active' })

    await expectStatus(confirm(client, pending.link.id).actingAs(pending.guardian), 404)
    const again = await confirm(client, active.link.id).actingAs(active.ward)
    again.assertStatus(409)
    again.assertBodyContains({ code: 'E_GUARDIAN_LINK_NOT_PENDING' })
  })

  test('test_the_guardian_sets_max_unlock_and_notification_actions', async ({ client, assert }) => {
    const { guardian, link } = await guardianPair({ state: 'active' })

    const response = await client
      .patch(`/api/v1/guardian/links/${link.id}`)
      .json({ maxUnlockMinutes: 120, allowNotificationActions: false })
      .actingAs(guardian)

    response.assertStatus(200)
    assert.equal(response.body().link.maxUnlockMinutes, 120)
    assert.isFalse(response.body().link.allowNotificationActions)
    await link.refresh()
    assert.equal(link.maxUnlockMinutes, 120)
    assert.isFalse(link.allowNotificationActions)
  })

  test('test_max_unlock_is_bounded_by_unlock_token_max_minutes', async ({ client }) => {
    const { guardian, link } = await guardianPair({ state: 'active' })
    const patch = (body: Record<string, unknown>) =>
      client.patch(`/api/v1/guardian/links/${link.id}`).json(body).actingAs(guardian)

    await expectStatus(patch({ maxUnlockMinutes: 121 }), 422)
    await expectStatus(patch({ maxUnlockMinutes: 0 }), 422)
    await expectStatus(patch({ maxUnlockMinutes: 1.5 }), 422)
    await expectStatus(patch({ allowNotificationActions: 'yes' }), 422)
    env.set('UNLOCK_TOKEN_MAX_MINUTES', 45)
    try {
      await expectStatus(patch({ maxUnlockMinutes: 46 }), 422)
      await expectStatus(patch({ maxUnlockMinutes: 45 }), 200)
    } finally {
      unsetEnv('UNLOCK_TOKEN_MAX_MINUTES')
    }
  })

  test('test_a_new_link_starts_at_thirty_minutes_or_the_instance_cap', async ({
    client,
    assert,
  }) => {
    env.set('UNLOCK_TOKEN_MAX_MINUTES', 20)
    try {
      const ward = await UserFactory.create()
      const { code } = await newPairingCode(client, ward)
      const response = await redeem(client, await UserFactory.create(), code)
      assert.equal(response.body().link.maxUnlockMinutes, 20)
    } finally {
      unsetEnv('UNLOCK_TOKEN_MAX_MINUTES')
    }
  })

  test('test_the_ward_cannot_change_the_guardians_settings', async ({ client, assert }) => {
    const { ward, link } = await guardianPair({ state: 'active' })

    await expectStatus(
      client
        .patch(`/api/v1/guardian/links/${link.id}`)
        .json({ maxUnlockMinutes: 60 })
        .actingAs(ward),
      404
    )
    await link.refresh()
    assert.equal(link.maxUnlockMinutes, 30)
  })

  test('test_guardian_settings_need_two_step_verification', async ({ client }) => {
    const { guardian, link } = await guardianPair({ state: 'pending', guardianTwoFactor: false })

    const response = await client
      .patch(`/api/v1/guardian/links/${link.id}`)
      .json({ maxUnlockMinutes: 10 })
      .actingAs(guardian)

    response.assertStatus(409)
    response.assertBodyContains({ code: 'E_GUARDIAN_TWO_FACTOR_REQUIRED' })
  })

  test('test_a_guardian_cannot_turn_two_step_verification_off_while_guarding', async ({
    client,
    assert,
  }) => {
    const { guardian } = await guardianPair({ state: 'active' })

    const response = await client
      .delete('/api/v1/me/two-factor')
      .json({ password: FACTORY_PASSPHRASE, code: '123456' })
      .actingAs(guardian)

    response.assertStatus(409)
    response.assertBodyContains({ code: 'E_GUARDIAN_TWO_FACTOR_REQUIRED' })
    await guardian.refresh()
    assert.isTrue(guardian.twoFactorEnabled)
  })

  test('test_a_link_lapsed_by_its_revocation_time_is_gone_from_every_route', async ({
    client,
    assert,
  }) => {
    const { ward, guardian, link } = await guardianPair({ state: 'active' })
    link.revocationRequestedAt = DateTime.utc().minus({ hours: 25 })
    link.revocationEffectiveAt = DateTime.utc().minus({ hours: 1 })
    await link.save()

    const listed = await client.get('/api/v1/guardian/links').actingAs(guardian)
    assert.deepEqual(listed.body().links, [])
    await expectStatus(
      client.get(`/api/v1/guardian/links/${link.id}/subscribe`).actingAs(guardian),
      404
    )
    await expectStatus(
      client.post(`/api/v1/guardian/links/${link.id}/cancel-revocation`).actingAs(ward),
      404
    )
    const row = await GuardianLink.findOrFail(link.id)
    assert.equal(row.status, 'active', 'only the job writes the final state')
  })
})
