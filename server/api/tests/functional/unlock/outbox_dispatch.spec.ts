// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomBytes } from 'node:crypto'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import limiter from '@adonisjs/limiter/services/main'
import env from '#start/env'
import Clock from '#services/clock'
import OutboxDispatcher from '#services/notify/outbox_dispatcher'
import { HttpNtfyPublisher } from '#services/notify/ntfy_publisher'
import { OutboxBypassAlerts } from '#services/notify/outbox_bypass_alerts'
import GuardianNotices from '#services/guardians/guardian_notices'
import { ntfyTopicFromBytes } from '#domain/guardians/ntfy_topic'
import { freezeTime } from '#tests/support/fixed_clock'
import { guardianPair } from '#tests/factories/guardian_link_factory'
import { BYPASS_EVENTS } from '#tests/support/guardians'
import {
  createRequest,
  fakeNtfy,
  NtfyPublisher,
  outboxOf,
  wardWithGuardian,
} from '#tests/support/unlock_flow'

const NOW = '2026-01-05T09:00:00Z'

async function dispatchDue() {
  const dispatcher = await app.container.make(OutboxDispatcher)
  const clock = await app.container.make(Clock)
  return dispatcher.dispatchDue(() => clock.now())
}

test.group('ntfy outbox dispatch', (group) => {
  let clock: ReturnType<typeof freezeTime>
  group.each.setup(async () => {
    await limiter.clear()
    clock = freezeTime(NOW)
  })
  group.each.teardown(() => {
    app.container.restore(Clock)
    app.container.restore(NtfyPublisher)
  })

  test('test_failures_back_off_10_s_30_s_2_min_then_give_up_with_last_error', async ({
    client,
    assert,
  }) => {
    const ntfy = fakeNtfy()
    ntfy.failing = true
    const { guardian, token } = await wardWithGuardian()
    await createRequest(client, token)

    for (const seconds of [10, 30, 120]) {
      assert.equal(await dispatchDue(), 0, 'nothing is due before the backoff')
      clock.advance({ seconds })
      assert.equal(await dispatchDue(), 1)
    }

    const [row] = await outboxOf(guardian)
    assert.equal(row.attempts, 4)
    assert.isNotNull(row.gave_up_at)
    assert.equal(row.last_error, 'ntfy answered 503')
    assert.notProperty(row.payload, 'sealedActions')
    clock.advance({ hours: 1 })
    assert.equal(await dispatchDue(), 0, 'a row given up on is never tried again')
  })

  test('test_a_retry_after_a_topic_rotation_goes_to_the_new_topic', async ({ client, assert }) => {
    const ntfy = fakeNtfy()
    ntfy.failing = true
    const { guardian, link, token } = await wardWithGuardian()
    await createRequest(client, token)
    await client
      .post(`/api/v1/guardian/links/${link.id}/rotate-topic`)
      .actingAs(guardian)
      .then((response) => response.assertStatus(200))
    await link.refresh()

    ntfy.failing = false
    clock.advance({ seconds: 10 })
    await dispatchDue()

    assert.deepEqual(
      ntfy.messages.map((message) => message.topic),
      [link.ntfyTopic]
    )
  })

  test('test_the_topic_rotated_notice_is_the_one_message_sent_to_the_old_topic', async ({
    client,
    assert,
  }) => {
    const ntfy = fakeNtfy()
    const { ward, link } = await guardianPair({ state: 'active' })
    const old = link.ntfyTopic

    await client.post(`/api/v1/guardian/links/${link.id}/rotate-topic`).actingAs(ward)
    await dispatchDue()

    assert.lengthOf(ntfy.messages, 1)
    assert.equal(ntfy.messages[0].topic, old)
    assert.equal(ntfy.messages[0].title, 'Subscribe again')
  })

  test('test_queued_guardian_notices_are_sent_in_the_guardians_locale', async ({ assert }) => {
    const ntfy = fakeNtfy()
    const { guardian, link } = await guardianPair({ state: 'active' })
    guardian.locale = 'es'
    await guardian.save()
    await db.transaction((trx) =>
      new GuardianNotices().queue(
        trx,
        link,
        { kind: 'pairing_ended', linkId: link.id },
        DateTime.fromISO(NOW)
      )
    )

    await dispatchDue()

    assert.equal(ntfy.messages[0].title, 'Vinculación terminada')
    const [row] = await outboxOf(guardian)
    assert.isNotNull(row.sent_at)
  })

  test('test_nothing_is_claimed_while_ntfy_is_not_configured', async ({ client, assert }) => {
    app.container.swap(NtfyPublisher, () => new HttpNtfyPublisher(undefined, undefined))
    const { guardian, token } = await wardWithGuardian()
    await createRequest(client, token)

    assert.equal(await dispatchDue(), 0)
    const [row] = await outboxOf(guardian)
    assert.equal(row.attempts, 0)
  })

  test('test_a_retry_is_given_up_once_the_link_or_the_request_is_over', async ({
    client,
    assert,
  }) => {
    const ntfy = fakeNtfy()
    ntfy.failing = true
    const closed = await wardWithGuardian()
    await createRequest(client, closed.token)
    const ended = await wardWithGuardian()
    await createRequest(client, ended.token)
    await db
      .from('unlock_requests')
      .where('device_id', closed.device.id)
      .update({ status: 'cancelled' })
    ended.link.status = 'revoked'
    ended.link.revokedAt = DateTime.fromISO(NOW)
    await ended.link.save()
    await db.transaction((trx) =>
      new GuardianNotices().queue(
        trx,
        ended.link,
        { kind: 'pairing_ended', linkId: ended.link.id },
        DateTime.fromISO(NOW)
      )
    )

    ntfy.failing = false
    clock.advance({ seconds: 10 })
    await dispatchDue()

    assert.deepEqual(
      ntfy.messages.map((message) => message.title),
      ['Pairing ended']
    )
    for (const who of [closed.guardian, ended.guardian]) {
      const [request] = await outboxOf(who)
      assert.isNotNull(request.gave_up_at)
      assert.isNull(request.sent_at)
    }
  })

  test('test_bypass_alerts_skip_guardian_kinds_and_collapse_a_batch', async ({ assert }) => {
    const { ward, guardian } = await guardianPair({ state: 'active' })
    const events = []
    for (const kind of ['extension_removed', 'time_changed', 'guardian_linked']) {
      const [row] = await db
        .table(BYPASS_EVENTS)
        .insert({
          ward_user_id: ward.id,
          device_id: null,
          kind,
          source: kind.startsWith('guardian_') ? 'server' : 'client',
          dedupe_key: `synthetic:${kind}`,
          occurred_at: new Date(NOW),
          details: JSON.stringify({}),
          created_at: new Date(NOW),
        })
        .returning(['id', 'kind'])
      events.push({
        id: row.id,
        wardUserId: ward.id,
        deviceId: null,
        kind: row.kind,
        source: 'client' as const,
        occurredAt: new Date(NOW),
      })
    }

    await new OutboxBypassAlerts().raised(events)

    const rows = await outboxOf(guardian)
    assert.lengthOf(rows, 1)
    assert.deepEqual(rows[0].payload, { type: 'bypass_alert', linkId: rows[0].payload.linkId })
    const stored = await db.from(BYPASS_EVENTS).where('ward_user_id', ward.id).orderBy('id')
    assert.deepEqual(
      stored.map((event) => event.notified_at !== null),
      [true, true, false]
    )
  })
})

async function ntfyIsUp(): Promise<boolean> {
  const baseUrl = env.get('NTFY_BASE_URL')
  if (!baseUrl) return false
  try {
    const response = await fetch(`${baseUrl}/v1/health`, { signal: AbortSignal.timeout(1000) })
    return response.ok
  } catch {
    return false
  }
}

const NTFY_UP = await ntfyIsUp()

/** Real ntfy from docker-compose.test.yml (NTFY_BASE_URL); skipped cleanly when it is not up. */
test.group('ntfy integration', () => {
  test('test_a_message_published_to_a_real_ntfy_reaches_the_topic', async ({ assert }) => {
    const baseUrl = env.get('NTFY_BASE_URL')!
    const topic = ntfyTopicFromBytes('mf-', randomBytes(16))
    const publisher = new HttpNtfyPublisher(baseUrl, env.get('NTFY_PUBLISH_TOKEN')?.release())

    const result = await publisher.publish({
      topic,
      title: 'Synthetic title',
      message: 'Synthetic message',
      priority: 4,
      tags: ['unlock'],
      actions: [{ action: 'view', label: 'Open', url: 'https://focus.example.org/guardian' }],
    })

    assert.deepEqual(result, { ok: true })
    const polled = await fetch(`${baseUrl}/${topic}/json?poll=1`).then((response) =>
      response.text()
    )
    const [message] = polled
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    assert.equal(message.title, 'Synthetic title')
    assert.equal(message.priority, 4)
    assert.equal(message.actions[0].action, 'view')
  }).skip(!NTFY_UP, 'ntfy from docker-compose.test.yml is not running')
})
