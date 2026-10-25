// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Clock from '#services/clock'
import { freezeTime } from '#tests/support/fixed_clock'
import { enrolledDevice } from '#tests/factories/device_factory'
import { DeviceRetentionJob } from '#scheduler/device_retention_job'
import { DEVICE_HEARTBEATS_TABLE } from '#services/devices/heartbeat_service'
import { ENROLLMENT_CODES_TABLE } from '#services/devices/enrollment_code_service'
import { ACCESS_TOKENS_TABLE } from '#services/devices/device_tokens'
import { BYPASS_EVENTS_TABLE } from '#services/devices/bypass_event_recorder'
import { SCHEDULER_RUNS_TABLE } from '#scheduler/scheduler_runs'
import { HASH } from '#tests/support/device_api'

const T0 = '2026-01-05T09:00:00Z'

function heartbeatAt(deviceId: number, receivedAt: Date) {
  return {
    device_id: deviceId,
    received_at: receivedAt,
    client_time: receivedAt,
    protection_active: true,
    rules_hash: HASH,
    policy_hash: HASH,
    client_version: '0.1.0',
    boot: '41',
  }
}

const hex = (digit: string) => digit.repeat(64)

test.group('Device data retention', (group) => {
  group.each.teardown(() => app.container.restore(Clock))

  test('test_heartbeats_older_than_thirty_days_are_pruned', async ({ assert }) => {
    const clock = freezeTime(T0)
    const { device } = await enrolledDevice()
    const now = clock.now()
    await db
      .table(DEVICE_HEARTBEATS_TABLE)
      .multiInsert([
        heartbeatAt(device.id, now.minus({ days: 30, seconds: 1 }).toJSDate()),
        heartbeatAt(device.id, now.minus({ days: 29 }).toJSDate()),
        heartbeatAt(device.id, now.toJSDate()),
      ])

    const pruned = await new DeviceRetentionJob().prune(now)

    assert.equal(pruned.heartbeats, 1)
    assert.lengthOf(await db.from(DEVICE_HEARTBEATS_TABLE).where('device_id', device.id), 2)
  })

  test('test_dead_codes_and_expired_tokens_are_pruned_but_bypass_events_stay', async ({
    assert,
  }) => {
    const clock = freezeTime(T0)
    const { user, device } = await enrolledDevice()
    const now = clock.now()
    await db.table(ENROLLMENT_CODES_TABLE).multiInsert([
      {
        user_id: user.id,
        lookup_hash: hex('a'),
        code_hash: hex('b'),
        expires_at: now.minus({ days: 1, minutes: 1 }).toJSDate(),
        used_at: now.minus({ days: 1, minutes: 5 }).toJSDate(),
        created_at: now.minus({ days: 2 }).toJSDate(),
      },
      {
        user_id: user.id,
        lookup_hash: hex('c'),
        code_hash: hex('d'),
        expires_at: now.minus({ minutes: 1 }).toJSDate(),
        created_at: now.minus({ minutes: 11 }).toJSDate(),
      },
    ])
    await db
      .from(ACCESS_TOKENS_TABLE)
      .where('tokenable_id', device.id)
      .update({ expires_at: now.minus({ seconds: 1 }).toJSDate() })
    await db.table(BYPASS_EVENTS_TABLE).insert({
      ward_user_id: user.id,
      device_id: device.id,
      kind: 'emergency_override',
      source: 'client',
      dedupe_key: `c:${device.uuid}:old`,
      occurred_at: now.minus({ days: 400 }).toJSDate(),
      details: '{}',
      created_at: now.minus({ days: 400 }).toJSDate(),
    })

    const pruned = await new DeviceRetentionJob().prune(now)

    assert.equal(pruned.enrollmentCodes, 1)
    assert.equal(pruned.accessTokens, 1)
    assert.lengthOf(await db.from(ENROLLMENT_CODES_TABLE).where('user_id', user.id), 1)
    assert.lengthOf(await db.from(BYPASS_EVENTS_TABLE).where('ward_user_id', user.id), 1)
  })

  test('test_retention_runs_once_per_day', async ({ assert }) => {
    const clock = freezeTime(T0)
    const job = new DeviceRetentionJob()
    const context = { now: () => clock.now(), signal: new AbortController().signal }

    await job.tick(context)
    await job.tick(context)
    clock.advance({ days: 1 })
    await job.tick(context)

    const runs = await db.from(SCHEDULER_RUNS_TABLE).where('job', 'device_retention')
    assert.deepEqual(runs.map((run) => run.period_key).sort(), ['2026-01-05', '2026-01-06'])
    assert.isTrue(runs.every((run) => run.outcome?.startsWith('pruned:')))
  })
})
