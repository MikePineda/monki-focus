// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import limiter from '@adonisjs/limiter/services/main'
import env from '#start/env'
import { parseRfc3339Utc, verifyUnlockToken } from '@monki-focus/protocol'
import Clock from '#services/clock'
import UnlockRequest from '#models/unlock_request'
import { freezeTime } from '#tests/support/fixed_clock'
import { enrolledDevice } from '#tests/factories/device_factory'
import { contractValidator, NONCE, BOOT, publishedKeyring } from '#tests/support/device_api'
import {
  createRequest,
  newRequestUuid,
  statusOf,
  fakeNtfy,
  NtfyPublisher,
  outboxOf,
  UNLOCK_BODY,
  wardWithGuardian,
} from '#tests/support/unlock_flow'

const NOW = '2026-01-05T09:00:00Z'

test.group('Device unlock requests', (group) => {
  group.each.setup(async () => {
    await limiter.clear()
    freezeTime(NOW)
  })
  group.each.teardown(() => {
    app.container.restore(Clock)
    app.container.restore(NtfyPublisher)
  })

  test('test_a_device_asks_and_the_guardian_is_notified_inside_the_request', async ({
    client,
    assert,
  }) => {
    const ntfy = fakeNtfy()
    const { guardian, link, token } = await wardWithGuardian()

    const response = await createRequest(client, token)

    response.assertStatus(201)
    assert.isTrue(contractValidator('UnlockRequest')(response.body()))
    assert.equal(response.body().status, 'pending')
    assert.equal(response.body().expiresAt, '2026-01-05T09:15:00Z')
    assert.lengthOf(ntfy.messages, 1)
    const [message] = ntfy.messages
    assert.equal(message.topic, link.ntfyTopic)
    assert.equal(message.priority, 4)
    assert.lengthOf(message.actions, 3)
    const [row] = await outboxOf(guardian)
    assert.isNotNull(row.sent_at)
    assert.notProperty(row.payload, 'sealedActions')
  })

  test('test_the_notification_carries_no_scope_reason_or_capability_in_clear', async ({
    client,
    assert,
  }) => {
    const ntfy = fakeNtfy()
    ntfy.failing = true
    const { guardian, token } = await wardWithGuardian()

    await createRequest(client, token)

    const [row] = await outboxOf(guardian)
    const stored = JSON.stringify(row.payload)
    assert.notInclude(stored, UNLOCK_BODY.scope.value)
    assert.notInclude(stored, UNLOCK_BODY.reason)
    assert.isString(row.payload.sealedActions)
    const request = await UnlockRequest.findByOrFail('uuid', row.payload.requestUuid)
    assert.match(request.approveActionHash!, /^[0-9a-f]{64}$/)
    assert.notInclude(stored, request.approveActionHash!)
  })

  test('test_a_failed_publication_stays_in_the_outbox_for_the_job', async ({ client, assert }) => {
    const ntfy = fakeNtfy()
    ntfy.failing = true
    const { guardian, token } = await wardWithGuardian()

    const response = await createRequest(client, token)

    response.assertStatus(201)
    const [row] = await outboxOf(guardian)
    assert.isNull(row.sent_at)
    assert.equal(row.attempts, 1)
    assert.equal(row.last_error, 'ntfy answered 503')
    assert.equal(new Date(row.next_attempt_at).toISOString(), '2026-01-05T09:00:10.000Z')
  })

  test('test_request_without_active_guardian_is_rejected', async ({ client }) => {
    fakeNtfy()
    const { token } = await enrolledDevice()
    const pending = await wardWithGuardian({ state: 'pending' })
    const noSecondFactor = await wardWithGuardian({ guardianTwoFactor: false })

    for (const deviceToken of [token, pending.token, noSecondFactor.token]) {
      const response = await createRequest(client, deviceToken)
      response.assertStatus(409)
      response.assertBody({ code: 'no_active_guardian' })
    }
  })

  test('test_a_revoking_link_still_receives_requests_until_its_deadline', async ({ client }) => {
    fakeNtfy()
    const { token } = await wardWithGuardian({ state: 'revoking' })

    await createRequest(client, token).then((response) => response.assertStatus(201))
  })

  test('test_rule_scope_is_out_of_v1', async ({ client }) => {
    fakeNtfy()
    const { token } = await wardWithGuardian()

    const response = await createRequest(client, token, {
      ...UNLOCK_BODY,
      scope: { kind: 'rule', value: 'social.video-feed' },
    })

    response.assertStatus(422)
    response.assertBody({ code: 'validation_failed', fields: { scope: 'scope_kind' } })
  })

  test('test_more_than_six_requests_an_hour_from_a_device_are_refused', async ({ client }) => {
    fakeNtfy()
    const { token } = await wardWithGuardian()

    for (let index = 0; index < 6; index += 1) {
      await createRequest(client, token).then((response) => response.assertStatus(201))
    }
    const seventh = await createRequest(client, token)

    seventh.assertStatus(429)
  })

  test('test_a_device_without_a_policy_hash_cannot_ask_yet', async ({ client }) => {
    fakeNtfy()
    const { device, token } = await wardWithGuardian()
    device.policyHash = null
    await device.save()

    const response = await createRequest(client, token)

    response.assertStatus(409)
    response.assertBody({ code: 'policy_unknown' })
  })

  test('test_minutes_are_capped_by_the_links_max_in_the_notification', async ({
    client,
    assert,
  }) => {
    const ntfy = fakeNtfy()
    const { link, token } = await wardWithGuardian()
    link.maxUnlockMinutes = 10
    await link.save()

    await createRequest(client, token, { ...UNLOCK_BODY, minutes: 60 })

    assert.equal(ntfy.messages[0].actions[0].label, 'Approve 10 min')
  })

  test('test_the_device_polls_its_request_and_gets_a_verifiable_token_once_approved', async ({
    client,
    assert,
  }) => {
    fakeNtfy()
    const { guardian, device, token } = await wardWithGuardian()
    const created = await createRequest(client, token)
    const uuid = created.body().uuid

    const before = await client.get(`/api/v1/device/unlock-requests/${uuid}`).asDevice(token)
    before.assertStatus(200)
    assert.equal(before.body().status, 'pending')
    assert.notProperty(before.body(), 'token')

    await client
      .post(`/api/v1/guardian/unlock-requests/${uuid}/approve`)
      .json({})
      .actingAs(guardian)
      .then((response) => response.assertStatus(200))

    const after = await client
      .get(`/api/v1/device/unlock-requests/${uuid}?nonce=${NONCE}&boot=${BOOT}`)
      .asDevice(token)
    after.assertStatus(200)
    after.assertHeader('cache-control', 'no-store')
    assert.isTrue(contractValidator('UnlockRequestStatus')(after.body()))
    assert.equal(after.body().status, 'approved')
    assert.equal(after.body().grantedMinutes, 15)
    assert.isString(after.body().timeToken)
    const verified = verifyUnlockToken(after.body().token, {
      keyring: await publishedKeyring('unlock'),
      issuer: env.get('APP_URL'),
      device: device.uuid,
      now: parseRfc3339Utc(NOW)!,
      issuerProfile: 'development',
    })
    assert.isTrue(verified.ok)
    if (verified.ok) {
      assert.equal(verified.value.claims.req, uuid)
      assert.equal(verified.value.claims.dur_s, 900)
      assert.deepEqual(verified.value.claims.scope, UNLOCK_BODY.scope)
    }
  })

  test('test_a_revoked_token_is_not_handed_out_again', async ({ client, assert }) => {
    fakeNtfy()
    const { guardian, token } = await wardWithGuardian()
    const uuid = await newRequestUuid(client, token)
    await client
      .post(`/api/v1/guardian/unlock-requests/${uuid}/approve`)
      .json({})
      .actingAs(guardian)
    await db.from('unlock_tokens').where('request_uuid', uuid).update({ revoked_at: new Date() })

    const poll = await client.get(`/api/v1/device/unlock-requests/${uuid}`).asDevice(token)

    assert.equal(poll.body().status, 'approved')
    assert.notProperty(poll.body(), 'token')
  })

  test('test_long_poll_returns_as_soon_as_the_guardian_decides', async ({ client, assert }) => {
    fakeNtfy()
    const { guardian, token } = await wardWithGuardian()
    const uuid = await newRequestUuid(client, token)

    const started = Date.now()
    const poll = client.get(`/api/v1/device/unlock-requests/${uuid}?wait=10`).asDevice(token)
    const decide = new Promise((resolve) => setTimeout(resolve, 300)).then(() =>
      client.post(`/api/v1/guardian/unlock-requests/${uuid}/deny`).actingAs(guardian)
    )
    const [answer] = await Promise.all([poll, decide])

    assert.equal(answer.body().status, 'denied')
    assert.isBelow(Date.now() - started, 5000)
  }).timeout(15_000)

  test('test_long_poll_wait_is_capped_at_25_seconds', async ({ client }) => {
    fakeNtfy()
    const { token } = await wardWithGuardian()
    const uuid = await newRequestUuid(client, token)

    const response = await client
      .get(`/api/v1/device/unlock-requests/${uuid}?wait=26`)
      .asDevice(token)

    response.assertStatus(422)
  })

  test('test_another_device_or_user_gets_404_never_403', async ({ client, assert }) => {
    fakeNtfy()
    const { ward, token } = await wardWithGuardian()
    const uuid = await newRequestUuid(client, token)
    const sibling = await enrolledDevice(ward)
    const stranger = await enrolledDevice()

    for (const other of [sibling.token, stranger.token]) {
      await client
        .get(`/api/v1/device/unlock-requests/${uuid}`)
        .asDevice(other)
        .then((response) => response.assertStatus(404))
      await client
        .delete(`/api/v1/device/unlock-requests/${uuid}`)
        .asDevice(other)
        .then((response) => response.assertStatus(404))
    }
    assert.equal(await statusOf(uuid), 'pending')
  })

  test('test_cancelling_withdraws_the_request_and_its_action_capabilities', async ({
    client,
    assert,
  }) => {
    fakeNtfy()
    const { token } = await wardWithGuardian()
    const uuid = await newRequestUuid(client, token)

    const response = await client.delete(`/api/v1/device/unlock-requests/${uuid}`).asDevice(token)

    response.assertStatus(204)
    const request = await UnlockRequest.findByOrFail('uuid', uuid)
    assert.equal(request.status, 'cancelled')
    assert.isNull(request.approveActionHash)
    assert.isNull(request.denyActionHash)
  })

  test('test_the_consumed_telemetry_is_recorded_only_for_the_devices_own_token', async ({
    client,
    assert,
  }) => {
    fakeNtfy()
    const { guardian, token } = await wardWithGuardian()
    const uuid = await newRequestUuid(client, token)
    await client
      .post(`/api/v1/guardian/unlock-requests/${uuid}/approve`)
      .json({})
      .actingAs(guardian)
    const { jti } = await db.from('unlock_tokens').where('request_uuid', uuid).firstOrFail()
    const stranger = await enrolledDevice()

    await client
      .post(`/api/v1/device/unlock-tokens/${jti}/consumed`)
      .asDevice(stranger.token)
      .then((response) => response.assertStatus(404))
    await client
      .post(`/api/v1/device/unlock-tokens/${jti}/consumed`)
      .asDevice(token)
      .then((response) => response.assertStatus(204))

    const row = await db.from('unlock_tokens').where('jti', jti).firstOrFail()
    assert.isNotNull(row.consumed_at)
  })
})
