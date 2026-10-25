// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import Clock from '#services/clock'
import { freezeTime } from '#tests/support/fixed_clock'
import { guardianPair } from '#tests/factories/guardian_link_factory'
import { expectStatus } from '#tests/support/expect_response'
import { unsetEnv } from '#tests/support/env_override'
import { OUTBOX, guardianEventsOf, noticesFor, guardianEventLog } from '#tests/support/guardians'

const NOW = '2026-01-05T09:00:00Z'

const rotate = (client: ApiClient, linkId: number) =>
  client.post(`/api/v1/guardian/links/${linkId}/rotate-topic`)
const subscribe = (client: ApiClient, linkId: number) =>
  client.get(`/api/v1/guardian/links/${linkId}/subscribe`)

test.group('ntfy subscription and topic rotation', (group) => {
  group.each.setup(() => limiter.clear())
  group.each.teardown(() => {
    app.container.restore(Clock)
    unsetEnv('NTFY_PUBLIC_URL')
  })

  test('test_the_guardian_subscribes_to_the_links_topic_on_the_public_server', async ({
    client,
    assert,
  }) => {
    const { guardian, link } = await guardianPair({ state: 'active' })
    env.set('NTFY_PUBLIC_URL', 'https://ntfy.example.org')

    const response = await subscribe(client, link.id).actingAs(guardian)

    response.assertStatus(200)
    response.assertHeader('cache-control', 'no-store')
    assert.deepEqual(response.body(), {
      subscription: {
        topic: link.ntfyTopic,
        url: `https://ntfy.example.org/${link.ntfyTopic}`,
        deepLink: `ntfy://ntfy.example.org/${link.ntfyTopic}`,
        qrPayload: `https://ntfy.example.org/${link.ntfyTopic}`,
      },
    })
  })

  test('test_without_a_public_url_the_publish_url_is_used', async ({ client, assert }) => {
    const { guardian, link } = await guardianPair({ state: 'active' })

    const response = await subscribe(client, link.id).actingAs(guardian)

    response.assertStatus(200)
    assert.equal(response.body().subscription.url, `${env.get('NTFY_BASE_URL')}/${link.ntfyTopic}`)
  })

  test('test_the_ward_never_gets_the_topic', async ({ client }) => {
    const { ward, link } = await guardianPair({ state: 'active' })

    await expectStatus(subscribe(client, link.id).actingAs(ward), 404)
  })

  test('test_a_pending_link_has_no_subscription_yet', async ({ client }) => {
    const { guardian, link } = await guardianPair({ state: 'pending' })

    const response = await subscribe(client, link.id).actingAs(guardian)

    response.assertStatus(409)
    response.assertBodyContains({ code: 'E_GUARDIAN_LINK_NOT_ACTIVE' })
  })

  test('test_subscribing_needs_the_guardians_two_step_verification', async ({ client }) => {
    const { guardian, link } = await guardianPair({ state: 'active', guardianTwoFactor: false })

    const response = await subscribe(client, link.id).actingAs(guardian)

    response.assertStatus(409)
    response.assertBodyContains({ code: 'E_GUARDIAN_TWO_FACTOR_REQUIRED' })
  })

  test('test_the_guardian_rotates_the_topic_and_alone_gets_the_new_one', async ({
    client,
    assert,
  }) => {
    const { ward, guardian, link } = await guardianPair({ state: 'active' })
    const old = link.ntfyTopic

    const response = await rotate(client, link.id).actingAs(guardian)

    response.assertStatus(200)
    await link.refresh()
    assert.notEqual(link.ntfyTopic, old)
    assert.match(link.ntfyTopic, /^mf-[a-z2-7]{26}$/)
    assert.equal(response.body().subscription.topic, link.ntfyTopic)
    assert.equal(response.body().link.id, link.id)
    assert.lengthOf(await noticesFor(guardian), 0, 'the guardian rotated it: nothing to tell')
    assert.lengthOf(await guardianEventsOf(ward), 0)
  })

  test('test_the_ward_rotates_and_the_guardian_hears_once_on_the_old_topic', async ({
    client,
    assert,
  }) => {
    freezeTime(NOW)
    const { ward, guardian, link } = await guardianPair({ state: 'active' })
    const old = link.ntfyTopic

    const response = await rotate(client, link.id).actingAs(ward)

    response.assertStatus(200)
    assert.deepEqual(Object.keys(response.body()), ['link'])
    await link.refresh()
    assert.notEqual(link.ntfyTopic, old)
    assert.notInclude(JSON.stringify(response.body()), link.ntfyTopic)
    assert.notInclude(JSON.stringify(response.body()), old)
    const notices = await noticesFor(guardian)
    assert.lengthOf(notices, 1)
    assert.equal(notices[0].topic, old, 'the last message the old topic ever gets')
    assert.deepEqual(notices[0].payload, {
      type: 'guardian_notice',
      kind: 'topic_rotated',
      linkId: link.id,
    })
    assert.deepEqual(await guardianEventLog(ward), [['guardian_topic_rotated', {}]])
  })

  test('test_unsent_notices_move_to_the_new_topic_and_sent_ones_stay', async ({
    client,
    assert,
  }) => {
    const { guardian, link } = await guardianPair({ state: 'active' })
    const old = link.ntfyTopic
    const row = (key: string, sentAt: Date | null) => ({
      recipient_user_id: guardian.id,
      channel: 'ntfy',
      topic: old,
      payload: JSON.stringify({
        type: 'guardian_notice',
        kind: 'revocation_cancelled',
        linkId: link.id,
      }),
      dedupe_key: key,
      attempts: 0,
      next_attempt_at: new Date(),
      sent_at: sentAt,
      created_at: new Date(),
    })
    await db.table(OUTBOX).insert([row('test:unsent', null), row('test:sent', new Date())])

    await expectStatus(rotate(client, link.id).actingAs(guardian), 200)

    await link.refresh()
    const unsent = await db.from(OUTBOX).where('dedupe_key', 'test:unsent').first()
    const sent = await db.from(OUTBOX).where('dedupe_key', 'test:sent').first()
    assert.equal(unsent.topic, link.ntfyTopic)
    assert.equal(sent.topic, old)
  })

  test('test_a_pending_link_cannot_rotate_yet', async ({ client }) => {
    const { guardian, link } = await guardianPair({ state: 'pending' })

    const response = await rotate(client, link.id).actingAs(guardian)

    response.assertStatus(409)
    response.assertBodyContains({ code: 'E_GUARDIAN_LINK_NOT_ACTIVE' })
  })

  test('test_rotating_is_limited_to_ten_per_hour_per_user', async ({ client }) => {
    const { guardian, link } = await guardianPair({ state: 'active' })
    for (let index = 0; index < 10; index++) {
      await expectStatus(rotate(client, link.id).actingAs(guardian), 200)
    }

    await expectStatus(rotate(client, link.id).actingAs(guardian), 429)
  })
})
