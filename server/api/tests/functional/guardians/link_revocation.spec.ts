// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import Clock from '#services/clock'
import Device from '#models/device'
import GuardianLink from '#models/guardian_link'
import { freezeTime } from '#tests/support/fixed_clock'
import { guardianPair } from '#tests/factories/guardian_link_factory'
import { enrolledDevice } from '#tests/factories/device_factory'
import { expectStatus } from '#tests/support/expect_response'
import { unsetEnv } from '#tests/support/env_override'
import { BypassAlerts, fakeBypassAlerts } from '#tests/support/device_api'
import { WardRevocationJob } from '#scheduler/ward_revocation_job'
import {
  BYPASS_EVENTS,
  guardianEventsOf,
  noticesFor,
  guardianEventLog,
  noticeKinds,
} from '#tests/support/guardians'

const NOW = '2026-01-05T09:00:00Z'

const revoke = (client: ApiClient, linkId: number) =>
  client.post(`/api/v1/guardian/links/${linkId}/revoke`)
const cancel = (client: ApiClient, linkId: number) =>
  client.post(`/api/v1/guardian/links/${linkId}/cancel-revocation`)
const summary = (client: ApiClient, wardId: number) =>
  client.get(`/api/v1/guardian/wards/${wardId}/summary`)
const subscribe = (client: ApiClient, linkId: number) =>
  client.get(`/api/v1/guardian/links/${linkId}/subscribe`)

async function runRevocationJob() {
  const clock = await app.container.make(Clock)
  return new WardRevocationJob().finalizeDue(clock.now())
}

test.group('Guardian link revocation', (group) => {
  group.each.setup(() => limiter.clear())
  group.each.teardown(() => {
    app.container.restore(Clock)
    app.container.restore(BypassAlerts)
  })

  test('test_guardian_revocation_is_immediate', async ({ client, assert }) => {
    freezeTime(NOW)
    const { ward, guardian, link } = await guardianPair({ state: 'active' })

    const response = await revoke(client, link.id).actingAs(guardian)

    response.assertStatus(204)
    await link.refresh()
    assert.equal(link.status, 'revoked')
    assert.equal(link.revokedAt?.toUTC().toISO(), '2026-01-05T09:00:00.000Z')
    assert.equal(link.revokedByUserId, guardian.id)
    await expectStatus(summary(client, ward.id).actingAs(guardian), 404)
    const events = await guardianEventsOf(ward)
    assert.deepEqual(
      events.map((event) => [event.kind, event.details]),
      [['guardian_unlinked', { endedBy: 'guardian', reason: 'revoked' }]]
    )
    assert.lengthOf(await noticesFor(guardian), 0, 'the guardian left: nothing to tell them')
  })

  test('test_ward_revocation_takes_effect_after_24h', async ({ client, assert }) => {
    const clock = freezeTime(NOW)
    const alerts = fakeBypassAlerts()
    const { ward, guardian, link } = await guardianPair({ state: 'active' })

    const response = await revoke(client, link.id).actingAs(ward)

    response.assertStatus(200)
    assert.equal(response.body().link.status, 'revoking')
    assert.equal(response.body().link.revocationRequestedAt, '2026-01-05T09:00:00.000Z')
    assert.equal(response.body().link.revocationEffectiveAt, '2026-01-06T09:00:00.000Z')
    const queued = await noticesFor(guardian)
    assert.lengthOf(queued, 1)
    assert.equal(queued[0].topic, link.ntfyTopic)
    assert.equal(queued[0].channel, 'ntfy')
    assert.isNull(queued[0].sent_at)
    assert.deepEqual(queued[0].payload, {
      type: 'guardian_notice',
      kind: 'revocation_requested',
      linkId: link.id,
      effectiveAt: '2026-01-06T09:00:00.000Z',
    })
    assert.deepEqual(await guardianEventLog(ward), [
      ['guardian_revocation_requested', { cooldownHours: 24 }],
    ])
    assert.include(alerts.kinds(), 'guardian_revocation_requested')

    // Two phases: the guardian stops seeing the ward at once...
    await expectStatus(summary(client, ward.id).actingAs(guardian), 404)
    // ...but keeps the approval channel through the cooldown...
    clock.advance({ hours: 23, minutes: 59 })
    await expectStatus(subscribe(client, link.id).actingAs(guardian), 200)
    // ...and loses the link on time, even before the job has run.
    clock.advance({ minutes: 1 })
    await expectStatus(subscribe(client, link.id).actingAs(guardian), 404)

    const finalized = await runRevocationJob()

    assert.equal(finalized, 1)
    await link.refresh()
    assert.equal(link.status, 'revoked')
    assert.equal(link.revokedAt?.toUTC().toISO(), '2026-01-06T09:00:00.000Z')
    assert.equal(link.revokedByUserId, ward.id)
    const notices = await noticesFor(guardian)
    assert.deepEqual(
      notices.map((notice) => notice.payload.kind),
      ['revocation_requested', 'pairing_ended']
    )
    assert.deepEqual(notices[1].payload, {
      type: 'guardian_notice',
      kind: 'pairing_ended',
      linkId: link.id,
    })
    assert.deepEqual(await guardianEventLog(ward), [
      ['guardian_revocation_requested', { cooldownHours: 24 }],
      ['guardian_unlinked', { endedBy: 'ward', reason: 'revoked' }],
    ])
  })

  test('test_the_cooldown_follows_ward_revocation_cooldown_hours', async ({ client, assert }) => {
    freezeTime(NOW)
    env.set('WARD_REVOCATION_COOLDOWN_HOURS', 2)
    try {
      const { ward, link } = await guardianPair({ state: 'active' })
      const response = await revoke(client, link.id).actingAs(ward)
      assert.equal(response.body().link.revocationEffectiveAt, '2026-01-05T11:00:00.000Z')
    } finally {
      unsetEnv('WARD_REVOCATION_COOLDOWN_HOURS')
    }
  })

  test('test_a_zero_cooldown_ends_the_link_at_once_with_a_neutral_notice', async ({
    client,
    assert,
  }) => {
    freezeTime(NOW)
    env.set('WARD_REVOCATION_COOLDOWN_HOURS', 0)
    try {
      const { ward, guardian, link } = await guardianPair({ state: 'active' })
      await expectStatus(revoke(client, link.id).actingAs(ward), 204)
      await link.refresh()
      assert.equal(link.status, 'revoked')
      assert.deepEqual(await noticeKinds(guardian), ['pairing_ended'])
    } finally {
      unsetEnv('WARD_REVOCATION_COOLDOWN_HOURS')
    }
  })

  test('test_asking_again_keeps_the_first_deadline_and_queues_nothing_new', async ({
    client,
    assert,
  }) => {
    const clock = freezeTime(NOW)
    const { ward, guardian, link } = await guardianPair({ state: 'active' })
    await expectStatus(revoke(client, link.id).actingAs(ward), 200)

    clock.advance({ hours: 5 })
    const again = await revoke(client, link.id).actingAs(ward)

    again.assertStatus(200)
    assert.equal(again.body().link.revocationEffectiveAt, '2026-01-06T09:00:00.000Z')
    assert.lengthOf(await noticesFor(guardian), 1)
  })

  test('test_the_ward_can_cancel_a_pending_revocation', async ({ client, assert }) => {
    const clock = freezeTime(NOW)
    const { ward, guardian, link } = await guardianPair({ state: 'active' })
    await expectStatus(revoke(client, link.id).actingAs(ward), 200)
    clock.advance({ hours: 1 })

    const response = await cancel(client, link.id).actingAs(ward)

    response.assertStatus(200)
    assert.equal(response.body().link.status, 'active')
    assert.isNull(response.body().link.revocationEffectiveAt)
    await link.refresh()
    assert.isNull(link.revocationRequestedAt)
    assert.deepEqual(await noticeKinds(guardian), ['revocation_requested', 'revocation_cancelled'])
    const log = await guardianEventLog(ward)
    assert.deepEqual(
      log.map((entry) => entry[0]),
      ['guardian_revocation_requested', 'guardian_revocation_cancelled']
    )
    clock.advance({ hours: 30 })
    assert.equal(await runRevocationJob(), 0)
    await expectStatus(summary(client, ward.id).actingAs(guardian), 200)
  })

  test('test_a_revoking_guardian_still_guards_so_two_factor_stays_on', async ({ client }) => {
    const { guardian } = await guardianPair({ state: 'revoking' })

    const response = await client
      .delete('/api/v1/me/two-factor')
      .json({ password: 'irrelevant password', code: '123456' })
      .actingAs(guardian)

    response.assertStatus(409)
    response.assertBodyContains({ code: 'E_GUARDIAN_TWO_FACTOR_REQUIRED' })
  })

  test('test_the_guardian_cannot_cancel_the_wards_request', async ({ client, assert }) => {
    const { guardian, link } = await guardianPair({ state: 'revoking' })

    await expectStatus(cancel(client, link.id).actingAs(guardian), 404)
    await link.refresh()
    assert.isNotNull(link.revocationEffectiveAt)
  })

  test('test_cancelling_without_a_pending_revocation_is_a_conflict', async ({ client }) => {
    const { ward, link } = await guardianPair({ state: 'active' })

    const response = await cancel(client, link.id).actingAs(ward)

    response.assertStatus(409)
    response.assertBodyContains({ code: 'E_NO_REVOCATION_PENDING' })
  })

  test('test_a_pending_link_ends_at_once_whoever_leaves', async ({ client, assert }) => {
    const byWard = await guardianPair({ state: 'pending' })
    const byGuardian = await guardianPair({ state: 'pending' })

    await expectStatus(revoke(client, byWard.link.id).actingAs(byWard.ward), 204)
    await expectStatus(revoke(client, byGuardian.link.id).actingAs(byGuardian.guardian), 204)

    for (const { link, guardian, ward } of [byWard, byGuardian]) {
      await link.refresh()
      assert.equal(link.status, 'revoked')
      assert.lengthOf(await noticesFor(guardian), 0)
      assert.lengthOf(await guardianEventsOf(ward), 0, 'nothing was ever granted')
    }
  })

  test('test_revocation_never_deletes_the_wards_data', async ({ client, assert }) => {
    const { ward, guardian, link } = await guardianPair({ state: 'active' })
    const { device } = await enrolledDevice(ward)
    await db.table(BYPASS_EVENTS).insert({
      ward_user_id: ward.id,
      device_id: device.id,
      kind: 'emergency_override',
      source: 'client',
      dedupe_key: `c:${device.uuid}:1`,
      occurred_at: new Date(),
      details: JSON.stringify({ scope: 'rule' }),
      created_at: new Date(),
    })

    await expectStatus(revoke(client, link.id).actingAs(guardian), 204)

    assert.isNotNull(await Device.find(device.id))
    const events = await db.from(BYPASS_EVENTS).where('ward_user_id', ward.id)
    assert.includeMembers(
      events.map((event) => event.kind),
      ['emergency_override', 'guardian_unlinked']
    )
    assert.isNotNull(await GuardianLink.find(link.id), 'the link stays as history')
  })

  test('test_a_revoked_link_answers_404_on_every_link_route', async ({ client }) => {
    const { ward, guardian, link } = await guardianPair({ state: 'revoked' })

    for (const user of [ward, guardian]) {
      await expectStatus(revoke(client, link.id).actingAs(user), 404)
      await expectStatus(cancel(client, link.id).actingAs(user), 404)
      await expectStatus(
        client.post(`/api/v1/guardian/links/${link.id}/rotate-topic`).actingAs(user),
        404
      )
    }
    await expectStatus(
      client
        .patch(`/api/v1/guardian/links/${link.id}`)
        .json({ maxUnlockMinutes: 5 })
        .actingAs(guardian),
      404
    )
  })

  test('test_the_revocation_job_finishes_each_link_once', async ({ client, assert }) => {
    const clock = freezeTime(NOW)
    const { ward, guardian, link } = await guardianPair({ state: 'active' })
    await expectStatus(revoke(client, link.id).actingAs(ward), 200)
    clock.advance({ hours: 25 })

    const results = await Promise.all([runRevocationJob(), runRevocationJob()])
    const later = await runRevocationJob()

    assert.equal(results[0] + results[1] + later, 1)
    const kinds = await noticeKinds(guardian)
    assert.lengthOf(
      kinds.filter((kind) => kind === 'pairing_ended'),
      1
    )
  })

  test('test_the_scheduler_runs_the_revocation_job', async ({ client, assert }) => {
    const clock = freezeTime(NOW)
    const { ward, link } = await guardianPair({ state: 'active' })
    await expectStatus(revoke(client, link.id).actingAs(ward), 200)
    clock.advance({ hours: 25 })

    const tick = await client.post('/api/test/tick').withCsrfToken()

    tick.assertStatus(200)
    assert.include(tick.body().jobs, 'ward_revocation_effective')
    await link.refresh()
    assert.equal(link.status, 'revoked')
  })
})
