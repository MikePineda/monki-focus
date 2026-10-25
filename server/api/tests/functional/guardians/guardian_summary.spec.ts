// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import Clock from '#services/clock'
import Device from '#models/device'
import type User from '#models/user'
import { freezeTime } from '#tests/support/fixed_clock'
import { UserFactory } from '#tests/factories/user_factory'
import { guardianPair } from '#tests/factories/guardian_link_factory'
import { enrolledDevice } from '#tests/factories/device_factory'
import { expectStatus } from '#tests/support/expect_response'
import { BYPASS_EVENTS } from '#tests/support/guardians'

const NOW = '2026-01-12T09:00:00Z'
/** Every link of these specs was confirmed before the events they store. */
const CONFIRMED = DateTime.fromISO('2026-01-01T09:00:00Z', { zone: 'utc' })

const summary = (client: ApiClient, wardId: number) =>
  client.get(`/api/v1/guardian/wards/${wardId}/summary`)

async function storeEvent(
  ward: User,
  deviceId: number | null,
  key: string,
  occurredAt: string,
  extra: Record<string, unknown> = {}
) {
  await db.table(BYPASS_EVENTS).insert({
    ward_user_id: ward.id,
    device_id: deviceId,
    kind: 'emergency_override',
    source: 'client',
    dedupe_key: key,
    occurred_at: new Date(occurredAt),
    details: JSON.stringify({ scope: 'rule', waitSeconds: 120 }),
    created_at: new Date(occurredAt),
    ...extra,
  })
}

test.group('Guardian summary', (group) => {
  group.each.setup(() => limiter.clear())
  group.each.teardown(() => app.container.restore(Clock))

  test('test_the_guardian_sees_scores_unlocks_and_bypasses_only', async ({ client, assert }) => {
    freezeTime(NOW)
    const { ward, guardian } = await guardianPair({ state: 'active', confirmedAt: CONFIRMED })
    const { device } = await enrolledDevice(ward)
    await storeEvent(ward, device.id, 'c:a:old', '2026-01-04T09:00:00Z')
    await storeEvent(ward, device.id, 'c:a:1', '2026-01-10T09:00:00Z')
    await storeEvent(ward, null, 's:heartbeat_missing:x', '2026-01-11T09:00:00Z', {
      kind: 'heartbeat_missing',
      source: 'server',
      details: JSON.stringify({ announced: false }),
    })

    const response = await summary(client, ward.id).actingAs(guardian)

    response.assertStatus(200)
    response.assertHeader('cache-control', 'no-store')
    const body = response.body()
    assert.deepEqual(Object.keys(body).sort(), [
      'bypasses',
      'generatedAt',
      'score',
      'unlocks',
      'wardUserId',
    ])
    assert.equal(body.wardUserId, ward.id)
    assert.equal(body.generatedAt, '2026-01-12T09:00:00.000Z')
    assert.deepEqual(body.score, { today: null, last7Days: null })
    assert.deepEqual(body.unlocks, { last7Days: { requested: 0, approved: 0, denied: 0 } })
    assert.equal(body.bypasses.last7Days, 2)
    assert.equal(body.bypasses.openGaps, 1)
    assert.deepEqual(
      body.bypasses.recent.map((event: { kind: string }) => event.kind),
      ['heartbeat_missing', 'emergency_override']
    )
    assert.deepEqual(body.bypasses.recent[1].details, { scope: 'rule', waitSeconds: 120 })
    assert.notInclude(JSON.stringify(body), device.uuid)
    assert.notInclude(JSON.stringify(body), device.name)
  })

  test('test_guardian_payload_never_contains_titles_or_urls', async ({ client, assert }) => {
    freezeTime(NOW)
    const { ward, guardian } = await guardianPair({ state: 'active', confirmedAt: CONFIRMED })
    await storeEvent(ward, null, 'c:a:hostile', '2026-01-11T09:00:00Z', {
      details: JSON.stringify({
        scope: 'rule',
        url: 'https://www.example.com/r/feed',
        title: 'A page title',
        domain: 'example.com',
        platform: 'www.example.com',
      }),
    })

    const response = await summary(client, ward.id).actingAs(guardian)

    response.assertStatus(200)
    const text = JSON.stringify(response.body())
    for (const forbidden of ['example.com', 'A page title', '"url"', '"title"', '"domain"']) {
      assert.notInclude(text, forbidden)
    }
    assert.deepEqual(response.body().bypasses.recent[0].details, { scope: 'rule' })
  })

  test('test_a_guardian_reaches_a_ward_only_through_an_active_link', async ({ client }) => {
    const stranger = await UserFactory.apply('twoFactor').create()
    const active = await guardianPair({ state: 'active' })
    const pending = await guardianPair({ state: 'pending' })
    const revoked = await guardianPair({ state: 'revoked' })
    const revoking = await guardianPair({ state: 'revoking' })
    const withoutTwoFactor = await guardianPair({ state: 'active', guardianTwoFactor: false })
    const lapsed = await guardianPair({ state: 'active' })
    lapsed.link.revocationRequestedAt = DateTime.utc().minus({ days: 2 })
    lapsed.link.revocationEffectiveAt = DateTime.utc().minus({ minutes: 1 })
    await lapsed.link.save()

    await expectStatus(summary(client, active.ward.id).actingAs(active.guardian), 200)
    for (const [who, ward] of [
      [stranger, active.ward],
      [pending.guardian, pending.ward],
      [revoked.guardian, revoked.ward],
      [revoking.guardian, revoking.ward],
      [withoutTwoFactor.guardian, withoutTwoFactor.ward],
      [lapsed.guardian, lapsed.ward],
      [active.ward, active.guardian],
      [active.ward, active.ward],
    ] as const) {
      const response = await summary(client, ward.id).actingAs(who)
      response.assertStatus(404)
      response.assertBody({ message: 'Not found', code: 'E_ROW_NOT_FOUND' })
    }
    await expectStatus(summary(client, 999_999).actingAs(active.guardian), 404)
    await expectStatus(
      client.get('/api/v1/guardian/wards/not-a-number/summary').actingAs(active.guardian),
      404
    )
  })

  test('test_the_summary_is_scoped_to_this_guardians_link', async ({ client, assert }) => {
    freezeTime(NOW)
    const ward = await UserFactory.create()
    const first = await guardianPair({ state: 'active', ward, confirmedAt: CONFIRMED })
    const laterConfirmed = DateTime.fromISO('2026-01-10T09:00:00Z', { zone: 'utc' })
    const second = await guardianPair({ state: 'active', ward, confirmedAt: laterConfirmed })
    const linked = (link: { id: number }, at: string) =>
      storeEvent(ward, null, `s:guardian_linked:${link.id}`, at, {
        kind: 'guardian_linked',
        source: 'server',
        details: '{}',
      })
    await linked(first.link, '2026-01-05T09:00:00Z')
    await linked(second.link, '2026-01-10T09:00:00Z')
    await storeEvent(
      ward,
      null,
      's:guardian_revocation_requested:999999:1',
      '2026-01-11T09:00:00Z',
      {
        kind: 'guardian_revocation_requested',
        source: 'server',
        details: JSON.stringify({ cooldownHours: 24 }),
      }
    )
    await storeEvent(ward, null, 'c:a:before-second', '2026-01-08T09:00:00Z')
    await storeEvent(ward, null, 'c:a:after-second', '2026-01-11T09:00:00Z')

    const asFirst = await summary(client, ward.id).actingAs(first.guardian)
    const asSecond = await summary(client, ward.id).actingAs(second.guardian)

    const keysOf = (response: typeof asFirst) =>
      response
        .body()
        .bypasses.recent.map((event: { kind: string; occurredAt: string }) => [
          event.kind,
          event.occurredAt,
        ])
    assert.deepEqual(keysOf(asFirst), [
      ['emergency_override', '2026-01-11T09:00:00.000Z'],
      ['emergency_override', '2026-01-08T09:00:00.000Z'],
      ['guardian_linked', '2026-01-05T09:00:00.000Z'],
    ])
    assert.equal(asFirst.body().bypasses.last7Days, 3)
    assert.deepEqual(keysOf(asSecond), [
      ['emergency_override', '2026-01-11T09:00:00.000Z'],
      ['guardian_linked', '2026-01-10T09:00:00.000Z'],
    ])
    assert.equal(asSecond.body().bypasses.last7Days, 2)
  })

  test('test_a_gap_still_open_after_eight_days_is_still_counted', async ({ client, assert }) => {
    freezeTime(NOW)
    const { ward, guardian } = await guardianPair({ state: 'active', confirmedAt: CONFIRMED })
    await storeEvent(ward, null, 's:heartbeat_missing:long', '2026-01-04T09:00:00Z', {
      kind: 'heartbeat_missing',
      source: 'server',
      details: JSON.stringify({ announced: false }),
    })
    await storeEvent(ward, null, 's:heartbeat_missing:before', '2025-12-31T09:00:00Z', {
      kind: 'heartbeat_missing',
      source: 'server',
      details: JSON.stringify({ announced: false }),
    })

    const response = await summary(client, ward.id).actingAs(guardian)

    assert.equal(response.body().bypasses.openGaps, 1, 'open since 8 days, after confirmation')
    assert.equal(response.body().bypasses.last7Days, 0)
  })

  test('test_guardian_cannot_read_ward_timeline_404', async ({ client, assert }) => {
    const { ward, guardian } = await guardianPair({ state: 'active' })
    const { device } = await enrolledDevice(ward)

    // Nothing of the ward's own routes opens to the guardian: 404 everywhere.
    await expectStatus(
      client.get(`/api/v1/analytics/timeline?date=2026-01-05`).actingAs(guardian),
      404
    )
    await expectStatus(
      client.patch(`/api/v1/devices/${device.uuid}`).json({ name: 'x' }).actingAs(guardian),
      404
    )
    await expectStatus(client.delete(`/api/v1/devices/${device.uuid}`).actingAs(guardian), 404)
    const devices = await client.get('/api/v1/devices').actingAs(guardian)
    assert.deepEqual(devices.body().devices, [])
    const exported = await client.get('/api/v1/me/export').actingAs(guardian)
    assert.notInclude(JSON.stringify(exported.body()), device.uuid)
    const untouched = await Device.findOrFail(device.id)
    assert.isNull(untouched.revokedAt)
  })
})
