// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import Clock from '#services/clock'
import { freezeTime, type FixedClock } from '#tests/support/fixed_clock'
import { DeviceFactory, enrolledDevice } from '#tests/factories/device_factory'
import { UserFactory } from '#tests/factories/user_factory'
import { DeadmanSwitchJob, deadmanPeriodKey } from '#scheduler/deadman_switch_job'
import { BYPASS_EVENTS_TABLE } from '#services/devices/bypass_event_recorder'
import { SCHEDULER_RUNS_TABLE } from '#scheduler/scheduler_runs'
import { BypassAlerts, bootKeys, fakeBypassAlerts, heartbeatBody } from '#tests/support/device_api'
import { expectStatus } from '#tests/support/expect_response'

const T0 = '2026-01-05T09:00:00Z'

function tick(job: DeadmanSwitchJob, clock: FixedClock) {
  return job.tick({ now: () => clock.now(), signal: new AbortController().signal })
}

async function events(userId: number, kind?: string) {
  const query = db.from(BYPASS_EVENTS_TABLE).where('ward_user_id', userId).orderBy('id')
  return kind ? query.where('kind', kind) : query
}

test.group('Dead-man switch', (group) => {
  group.each.setup(async () => {
    await limiter.clear()
    await bootKeys()
  })
  group.each.teardown(() => {
    app.container.restore(Clock)
    app.container.restore(BypassAlerts)
  })

  test('test_dead_man_alert_after_missed_heartbeats', async ({ assert }) => {
    const clock = freezeTime(T0)
    const alerts = fakeBypassAlerts()
    const { user, device } = await enrolledDevice(undefined, {
      protectionActive: true,
      lastSeenAt: clock.now(),
    })
    const job = new DeadmanSwitchJob()

    clock.advance({ hours: 5, minutes: 59 })
    await tick(job, clock)
    assert.lengthOf(await events(user.id, 'heartbeat_missing'), 0)

    clock.advance({ minutes: 1 })
    await tick(job, clock)
    const raised = await events(user.id, 'heartbeat_missing')
    assert.lengthOf(raised, 1)
    assert.equal(raised[0].device_id, device.id)
    assert.equal(raised[0].source, 'server')
    assert.equal(raised[0].occurred_at.toISOString(), '2026-01-05T15:00:00.000Z')
    assert.deepEqual(raised[0].details, { deadmanHours: 6, announced: false })
    assert.isNull(raised[0].resolved_at)
    assert.deepEqual(alerts.kinds(), ['heartbeat_missing'])
  })

  test('test_the_dead_man_job_raises_a_gap_once_however_often_it_runs', async ({ assert }) => {
    const clock = freezeTime(T0)
    const alerts = fakeBypassAlerts()
    const { user } = await enrolledDevice(undefined, {
      protectionActive: true,
      lastSeenAt: clock.now().minus({ hours: 7 }),
    })
    const job = new DeadmanSwitchJob()

    await tick(job, clock)
    await tick(job, clock)
    // A second container in the same window finds the claim taken.
    await tick(new DeadmanSwitchJob(), clock)
    clock.advance({ minutes: 5 })
    await tick(job, clock)
    clock.advance({ hours: 3 })
    await tick(job, clock)
    await job.raise(clock.now())

    assert.lengthOf(await events(user.id, 'heartbeat_missing'), 1)
    assert.deepEqual(alerts.kinds(), ['heartbeat_missing'])
    const runs = await db.from(SCHEDULER_RUNS_TABLE).where('job', 'deadman')
    assert.lengthOf(runs, 3)
  })

  test('test_unprotected_revoked_and_recent_devices_never_trigger', async ({ assert }) => {
    const clock = freezeTime(T0)
    const user = await UserFactory.create()
    const old = clock.now().minus({ hours: 30 })
    await DeviceFactory.merge({ userId: user.id, lastSeenAt: old }).create()
    await DeviceFactory.apply('protected')
      .apply('revoked')
      .merge({ userId: user.id, lastSeenAt: old })
      .create()
    await DeviceFactory.apply('protected')
      .merge({ userId: user.id, lastSeenAt: clock.now().minus({ hours: 1 }) })
      .create()

    await tick(new DeadmanSwitchJob(), clock)

    assert.lengthOf(await events(user.id), 0)
  })

  test('test_each_device_has_its_own_threshold', async ({ assert }) => {
    const clock = freezeTime(T0)
    const { user } = await enrolledDevice(undefined, {
      protectionActive: true,
      deadmanHours: 1,
      lastSeenAt: clock.now().minus({ hours: 1 }),
    })

    await tick(new DeadmanSwitchJob(), clock)

    const raised = await events(user.id, 'heartbeat_missing')
    assert.lengthOf(raised, 1)
    assert.equal(raised[0].details.deadmanHours, 1)
  })

  test('test_returning_device_resolves_gap_with_duration', async ({ client, assert }) => {
    const clock = freezeTime(T0)
    const alerts = fakeBypassAlerts()
    const { user, token } = await enrolledDevice(undefined, {
      protectionActive: true,
      lastSeenAt: clock.now(),
    })
    const job = new DeadmanSwitchJob()
    clock.advance({ hours: 7 })
    await tick(job, clock)

    await expectStatus(
      client
        .post('/api/v1/device/heartbeat')
        .json(await heartbeatBody())
        .asDevice(token),
      200
    )
    await expectStatus(
      client
        .post('/api/v1/device/heartbeat')
        .json(await heartbeatBody())
        .asDevice(token),
      200
    )

    const missing = await events(user.id, 'heartbeat_missing')
    assert.equal(missing[0].resolved_at?.toISOString(), '2026-01-05T16:00:00.000Z')
    const resumed = await events(user.id, 'heartbeat_resumed')
    assert.lengthOf(resumed, 1)
    assert.deepEqual(resumed[0].details, { gapSeconds: 7 * 3600, announced: false })
    assert.deepEqual(alerts.kinds(), ['heartbeat_missing', 'heartbeat_resumed'])

    // A new gap after the device came back is a new alert.
    clock.advance({ hours: 6, minutes: 5 })
    await tick(job, clock)
    assert.lengthOf(await events(user.id, 'heartbeat_missing'), 2)
  })

  test('test_announced_offline_still_alerts_flagged', async ({ client, assert }) => {
    const clock = freezeTime(T0)
    const { user, token } = await enrolledDevice(undefined, { lastSeenAt: clock.now() })
    await expectStatus(
      client
        .post('/api/v1/device/heartbeat')
        .json(await heartbeatBody({ goingOffline: true }))
        .asDevice(token),
      200
    )

    clock.advance({ hours: 6 })
    await tick(new DeadmanSwitchJob(), clock)

    const raised = await events(user.id, 'heartbeat_missing')
    assert.lengthOf(raised, 1)
    assert.deepEqual(raised[0].details, { deadmanHours: 6, announced: true })
  })

  test('test_turning_protection_off_is_reported_since_the_dead_man_stops_watching', async ({
    client,
    assert,
  }) => {
    const clock = freezeTime(T0)
    const alerts = fakeBypassAlerts()
    const { user, token } = await enrolledDevice(undefined, {
      protectionActive: true,
      lastSeenAt: clock.now(),
    })
    const beat = async (protectionActive: boolean) =>
      expectStatus(
        client
          .post('/api/v1/device/heartbeat')
          .json(await heartbeatBody({ protectionActive }))
          .asDevice(token),
        200
      )

    await beat(true)
    await beat(false)
    await beat(false)
    clock.advance({ hours: 30 })
    await tick(new DeadmanSwitchJob(), clock)

    assert.deepEqual(alerts.kinds(), ['protection_disabled'])
    assert.lengthOf(await events(user.id, 'protection_disabled'), 1)
    assert.lengthOf(await events(user.id, 'heartbeat_missing'), 0)
  })

  test('test_devices_already_alerted_never_starve_a_newly_overdue_one', async ({ assert }) => {
    const clock = freezeTime(T0)
    const user = await UserFactory.create()
    const longAgo = clock.now().minus({ days: 3 }).toJSDate()
    const rows = Array.from({ length: 501 }, (_, index) => ({
      uuid: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      user_id: user.id,
      name: `Silent ${index}`,
      platform: 'android',
      client_version: '0.1.0',
      protection_active: true,
      enrolled_kids: JSON.stringify({ unlock: [], policy: [] }),
      last_seen_at: longAgo,
      created_at: longAgo,
      updated_at: longAgo,
    }))
    const silent = (await db
      .table('devices')
      .multiInsert(rows)
      .returning(['id', 'uuid'])) as Array<{
      id: number
      uuid: string
    }>
    await db.table(BYPASS_EVENTS_TABLE).multiInsert(
      silent.map((device) => ({
        ward_user_id: user.id,
        device_id: device.id,
        kind: 'heartbeat_missing',
        source: 'server',
        dedupe_key: `s:heartbeat_missing:${device.uuid}:already`,
        occurred_at: longAgo,
        details: '{}',
        created_at: longAgo,
      }))
    )
    const { device: fresh } = await enrolledDevice(user, {
      protectionActive: true,
      lastSeenAt: clock.now().minus({ hours: 7 }),
    })

    await new DeadmanSwitchJob().raise(clock.now())

    const raised = await db
      .from(BYPASS_EVENTS_TABLE)
      .where('device_id', fresh.id)
      .where('kind', 'heartbeat_missing')
    assert.lengthOf(raised, 1)
  })

  test('test_a_heartbeat_landing_between_scan_and_insert_raises_no_false_alert', async ({
    client,
    assert,
  }) => {
    const clock = freezeTime(T0)
    const alerts = fakeBypassAlerts()
    const { user, token } = await enrolledDevice(undefined, {
      protectionActive: true,
      lastSeenAt: clock.now().minus({ hours: 7 }),
    })
    const job = new DeadmanSwitchJob()

    const overdue = await job.overdue(clock.now())
    await expectStatus(
      client
        .post('/api/v1/device/heartbeat')
        .json(await heartbeatBody())
        .asDevice(token),
      200
    )
    const stored = await job.alert(overdue, clock.now())

    assert.equal(stored, 0)
    assert.lengthOf(await events(user.id, 'heartbeat_missing'), 0)
    assert.deepEqual(alerts.kinds(), [])
  })

  test('test_the_claim_window_is_five_minutes', ({ assert }) => {
    const at = (iso: string) => deadmanPeriodKey(DateTime.fromISO(iso, { zone: 'utc' }))

    assert.equal(at('2026-01-05T09:04:59Z'), '2026-01-05T09:00')
    assert.equal(at('2026-01-05T09:05:00Z'), '2026-01-05T09:05')
  })
})
