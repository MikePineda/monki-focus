// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import limiter from '@adonisjs/limiter/services/main'
import Clock from '#services/clock'
import UnlockRequest from '#models/unlock_request'
import { freezeTime } from '#tests/support/fixed_clock'
import { UserFactory } from '#tests/factories/user_factory'
import {
  actionUrls,
  createRequest,
  statusOf,
  fakeNtfy,
  NtfyPublisher,
  pathOf,
  UNLOCK_BODY,
  wardWithGuardian,
} from '#tests/support/unlock_flow'

const NOW = '2026-01-05T09:00:00Z'

async function pendingRequest(client: Parameters<typeof createRequest>[0], options = {}) {
  const ntfy = fakeNtfy()
  const pair = await wardWithGuardian(options)
  const response = await createRequest(client, pair.token)
  response.assertStatus(201)
  const uuid: string = response.body().uuid
  return { ...pair, ntfy, uuid, urls: actionUrls(ntfy.messages[0]) }
}

test.group('Unlock decisions', (group) => {
  let clock: ReturnType<typeof freezeTime>
  group.each.setup(async () => {
    await limiter.clear()
    clock = freezeTime(NOW)
  })
  group.each.teardown(() => {
    app.container.restore(Clock)
    app.container.restore(NtfyPublisher)
  })

  test('test_the_guardian_approves_from_the_web_with_fewer_minutes', async ({ client, assert }) => {
    const { guardian, uuid, ntfy } = await pendingRequest(client)

    const response = await client
      .post(`/api/v1/guardian/unlock-requests/${uuid}/approve`)
      .json({ minutes: 5 })
      .actingAs(guardian)

    response.assertStatus(200)
    response.assertBodyContains({
      request: { status: 'approved', grantedMinutes: 5, decidedVia: 'web' },
    })
    const request = await UnlockRequest.findByOrFail('uuid', uuid)
    assert.equal(request.decidedByUserId, guardian.id)
    assert.isNull(request.approveActionHash)
    assert.isNull(request.denyActionHash)
    assert.equal(ntfy.messages.at(-1)?.title, 'Unlock approved')
    const ledger = await db.from('unlock_tokens').where('request_uuid', uuid)
    assert.lengthOf(ledger, 1)
  })

  test('test_web_approval_is_capped_by_the_links_max', async ({ client }) => {
    const { guardian, uuid } = await pendingRequest(client)

    const response = await client
      .post(`/api/v1/guardian/unlock-requests/${uuid}/approve`)
      .json({ minutes: 200 })
      .actingAs(guardian)

    response.assertBodyContains({ request: { grantedMinutes: 30 } })
  })

  test('test_second_decision_on_a_request_is_rejected', async ({ client, assert }) => {
    const { guardian, uuid, urls } = await pendingRequest(client)
    await client.post(`/api/v1/guardian/unlock-requests/${uuid}/deny`).actingAs(guardian)

    const again = await client
      .post(`/api/v1/guardian/unlock-requests/${uuid}/approve`)
      .json({})
      .actingAs(guardian)
    const viaAction = await client.post(pathOf(urls.approve))

    again.assertStatus(409)
    again.assertBodyContains({ code: 'E_UNLOCK_REQUEST_CLOSED' })
    viaAction.assertStatus(404)
    assert.equal(await statusOf(uuid), 'denied')
    assert.lengthOf(await db.from('unlock_tokens').where('request_uuid', uuid), 0)
  })

  test('test_decision_after_expiry_is_rejected', async ({ client }) => {
    const { guardian, uuid } = await pendingRequest(client)
    clock.advance({ minutes: 16 })

    const response = await client
      .post(`/api/v1/guardian/unlock-requests/${uuid}/approve`)
      .json({})
      .actingAs(guardian)

    response.assertStatus(409)
  })

  test('test_another_guardian_gets_404', async ({ client }) => {
    const { uuid } = await pendingRequest(client)
    const stranger = await UserFactory.apply('twoFactor').create()

    const response = await client
      .post(`/api/v1/guardian/unlock-requests/${uuid}/approve`)
      .json({})
      .actingAs(stranger)

    response.assertStatus(404)
  })

  test('test_the_ntfy_approve_action_decides_once_and_kills_the_deny_capability', async ({
    client,
    assert,
  }) => {
    const { uuid, urls } = await pendingRequest(client)

    const first = await client.post(pathOf(urls.approve))
    const replay = await client.post(pathOf(urls.approve))
    const sibling = await client.post(pathOf(urls.deny))

    first.assertStatus(200)
    first.assertBody({ status: 'recorded' })
    replay.assertStatus(404)
    sibling.assertStatus(404)
    assert.deepEqual(replay.body(), sibling.body())
    const request = await UnlockRequest.findByOrFail('uuid', uuid)
    assert.equal(request.status, 'approved')
    assert.equal(request.decidedVia, 'notification')
  })

  test('test_the_deny_action_denies', async ({ client, assert }) => {
    const { uuid, urls } = await pendingRequest(client)

    await client.post(pathOf(urls.deny)).then((response) => response.assertStatus(200))

    assert.equal(await statusOf(uuid), 'denied')
  })

  test('test_approve_via_get_is_rejected', async ({ client, assert }) => {
    const { uuid, urls } = await pendingRequest(client)

    const page = await client.get(pathOf(urls.approve))

    page.assertStatus(200)
    page.assertHeader('content-type', 'text/html; charset=utf-8')
    assert.include(page.text(), '<form method="post">')
    assert.notInclude(page.text(), urls.approve.split('/').at(-1)!)
    assert.equal(await statusOf(uuid), 'pending')
  })

  test('test_the_confirmation_form_posts_and_answers_a_page', async ({ client, assert }) => {
    const { uuid, urls } = await pendingRequest(client)

    const response = await client.post(pathOf(urls.approve)).form({})

    response.assertStatus(200)
    assert.include(response.text(), 'Your decision was recorded.')
    assert.equal(await statusOf(uuid), 'approved')
  })

  test('test_unknown_used_and_expired_capabilities_get_the_same_neutral_answer', async ({
    client,
    assert,
  }) => {
    const { urls } = await pendingRequest(client)
    const unknown = await client.post(`/api/v1/actions/${'A'.repeat(43)}`)
    const malformed = await client.post('/api/v1/actions/not-a-token')
    clock.advance({ minutes: 15 })
    const expired = await client.post(pathOf(urls.approve))

    for (const response of [unknown, malformed, expired]) {
      response.assertStatus(404)
      assert.deepEqual(response.body(), { status: 'unavailable' })
    }
  })

  test('test_actions_are_refused_when_the_guardian_turned_them_off', async ({ client, assert }) => {
    const { link, uuid, urls } = await pendingRequest(client)
    link.allowNotificationActions = false
    await link.save()

    const response = await client.post(pathOf(urls.approve))

    response.assertStatus(404)
    assert.equal(await statusOf(uuid), 'pending')
  })

  test('test_strict_mode_publishes_only_the_view_action', async ({ client, assert }) => {
    const ntfy = fakeNtfy()
    const { link, token } = await wardWithGuardian()
    link.allowNotificationActions = false
    await link.save()

    await createRequest(client, token)

    assert.deepEqual(
      ntfy.messages[0].actions.map((action) => action.action),
      ['view']
    )
  })

  test('test_a_guardian_who_turned_two_step_verification_off_cannot_decide', async ({
    client,
    assert,
  }) => {
    const { guardian, uuid, urls } = await pendingRequest(client)
    guardian.totpEnabledAt = null
    await guardian.save()

    const action = await client.post(pathOf(urls.approve))

    action.assertStatus(404)
    assert.equal(await statusOf(uuid), 'pending')
  })

  test('test_the_guardian_lists_pending_requests_with_host_only', async ({ client, assert }) => {
    fakeNtfy()
    const { guardian, token } = await wardWithGuardian()
    await createRequest(client, token, {
      ...UNLOCK_BODY,
      scope: { kind: 'path', value: 'video.example.com/watch/some-synthetic-id' },
    })

    const response = await client
      .get('/api/v1/guardian/unlock-requests?status=pending')
      .actingAs(guardian)

    response.assertStatus(200)
    const [listed] = response.body().requests
    assert.deepEqual(listed.scope, { kind: 'path', target: 'video.example.com' })
    assert.notInclude(JSON.stringify(response.body()), 'some-synthetic-id')
    const stranger = await UserFactory.apply('twoFactor').create()
    const none = await client.get('/api/v1/guardian/unlock-requests').actingAs(stranger)
    assert.deepEqual(none.body().requests, [])
  })

  test('test_the_ward_reads_their_own_history_only', async ({ client, assert }) => {
    const { ward, uuid } = await pendingRequest(client)
    const stranger = await UserFactory.create()

    const own = await client.get('/api/v1/unlock-requests').actingAs(ward)
    const other = await client.get('/api/v1/unlock-requests').actingAs(stranger)

    own.assertStatus(200)
    assert.equal(own.body().data[0].uuid, uuid)
    assert.deepEqual(own.body().data[0].scope, UNLOCK_BODY.scope)
    assert.deepEqual(other.body().data, [])
  })

  test('test_the_expiry_job_closes_overdue_requests', async ({ client, assert }) => {
    const { uuid } = await pendingRequest(client)
    clock.advance({ minutes: 15 })

    const { ExpireUnlockRequestsJob } = await import('#scheduler/expire_unlock_requests_job')
    await new ExpireUnlockRequestsJob().tick({
      now: () => clock.now(),
      signal: new AbortController().signal,
    })

    const request = await UnlockRequest.findByOrFail('uuid', uuid)
    assert.equal(request.status, 'expired')
    assert.isNull(request.approveActionHash)
  })
})
