// SPDX-License-Identifier: AGPL-3.0-or-later
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import env from '#start/env'
import Clock from '#services/clock'
import User from '#models/user'
import Invitation from '#models/invitation'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import { freezeTime } from '#tests/support/fixed_clock'
import { UserFactory } from '#tests/factories/user_factory'
import { oneWayDigest } from '#domain/accounts/one_way_digest'

const NOW = '2026-01-05T09:00:00Z'

/** A sign-up body for `email`, with a policy-compliant passphrase. */
function signUp(email: string, extra: Record<string, unknown> = {}) {
  return { email, fullName: 'New user', password: 'quartz pebble harbor 7', ...extra }
}

/** The link's secret part, as the dashboard reads it from the fragment. */
function fragmentOf(url: string) {
  return url.split('#')[1]
}

test.group('Accounts / admin invitations', (group) => {
  group.each.setup(() => limiter.clear())
  group.each.teardown(() => app.container.restore(Clock))

  test('test_an_admin_creates_a_seven_day_invitation_and_sees_the_link_once', async ({
    client,
    assert,
  }) => {
    freezeTime(NOW)
    const admin = await UserFactory.apply('admin').create()

    const response = await client
      .post('/api/v1/admin/invitations')
      .json({ email: 'Invitee@example.com' })
      .actingAs(admin)

    response.assertStatus(201)
    const { invitation, url } = response.body()
    assert.match(url, /^http:\/\/127\.0\.0\.1:3333\/invite#[A-Za-z0-9_-]{43}$/)
    assert.deepEqual(invitation, {
      id: invitation.id,
      email: 'invitee@example.com',
      status: 'pending',
      expiresAt: '2026-01-12T09:00:00.000Z',
      usedAt: null,
      createdAt: invitation.createdAt,
    })
    response.assertHeader('cache-control', 'no-store')

    const stored = await Invitation.findOrFail(invitation.id)
    assert.equal(stored.tokenHash, oneWayDigest(fragmentOf(url)))
    assert.notInclude(JSON.stringify(stored.serialize()), fragmentOf(url))

    const list = await client.get('/api/v1/admin/invitations').actingAs(admin)
    list.assertStatus(200)
    assert.lengthOf(list.body().invitations, 1)
    assert.notInclude(JSON.stringify(list.body()), fragmentOf(url))
  })

  test('test_a_non_admin_gets_the_404_of_an_unknown_route', async ({ client }) => {
    const user = await UserFactory.create()

    for (const request of [
      client.get('/api/v1/admin/invitations'),
      client.post('/api/v1/admin/invitations').json({}),
    ]) {
      const response = await request.actingAs(user)
      response.assertStatus(404)
      response.assertBody({ message: 'Not found', code: 'E_ROUTE_NOT_FOUND' })
    }
  })

  test('test_an_admin_revokes_an_invitation_and_its_link_stops_working', async ({ client }) => {
    const admin = await UserFactory.apply('admin').create()
    const created = await client.post('/api/v1/admin/invitations').json({}).actingAs(admin)
    const { invitation, url } = created.body()

    const revoke = await client.delete(`/api/v1/admin/invitations/${invitation.id}`).actingAs(admin)
    revoke.assertStatus(204)

    const accept = await client
      .post('/api/v1/auth/register')
      .json(signUp('late@example.com', { invitation: fragmentOf(url) }))
      .withCsrfToken()
    accept.assertStatus(400)
    accept.assertBodyContains({ code: 'E_REGISTRATION_REJECTED' })
  })

  test('test_invitation_creation_is_rate_limited_per_admin', async ({ client }) => {
    const admin = await UserFactory.apply('admin').create()

    for (let index = 0; index < 20; index++) {
      const response = await client.post('/api/v1/admin/invitations').json({}).actingAs(admin)
      response.assertStatus(201)
    }
    const blocked = await client.post('/api/v1/admin/invitations').json({}).actingAs(admin)
    blocked.assertStatus(429)
  })
})

test.group('Accounts / registration', (group) => {
  group.each.setup(() => limiter.clear())
  group.each.teardown(() => {
    app.container.restore(Clock)
    env.set('REGISTRATION_OPEN', false)
  })

  async function invite(email: string | null = null) {
    const admin = await UserFactory.apply('admin').create()
    return { admin, ...(await createInvitation(admin, email)) }
  }

  async function createInvitation(admin: User, email: string | null) {
    const { default: InvitationService } = await import('#services/accounts/invitation_service')
    const clock = await app.container.make(Clock)
    const { invitation, url } = await new InvitationService().create(admin, email, clock.now())
    return { invitation, fragment: fragmentOf(url) }
  }

  test('test_accepting_an_invitation_creates_the_account_and_signs_in', async ({
    client,
    assert,
  }) => {
    freezeTime(NOW)
    const { invitation, fragment } = await invite()

    const response = await client
      .post('/api/v1/auth/register')
      .json(
        signUp('Joiner@example.com', {
          invitation: fragment,
          locale: 'es',
          timeZone: 'America/Mexico_City',
          weekStart: 7,
        })
      )
      .withCsrfToken()

    response.assertStatus(201)
    response.assertBodyContains({
      user: {
        email: 'joiner@example.com',
        fullName: 'New user',
        locale: 'es',
        timeZone: 'America/Mexico_City',
        weekStart: 7,
        isAdmin: false,
      },
    })
    const user = await User.findByOrFail('email', 'joiner@example.com')
    response.assertSession('auth_web', user.id)
    response.assertSession('sv', 0)
    assert.notEqual(user.password, 'quartz pebble harbor 7')

    await invitation.refresh()
    assert.equal(invitation.usedByUserId, user.id)
    assert.equal(invitation.usedAt?.toUTC().toISO(), '2026-01-05T09:00:00.000Z')
  })

  test('test_an_invitation_works_only_once', async ({ client }) => {
    const { fragment } = await invite()

    const first = await client
      .post('/api/v1/auth/register')
      .json(signUp('first@example.com', { invitation: fragment }))
      .withCsrfToken()
    first.assertStatus(201)

    const second = await client
      .post('/api/v1/auth/register')
      .json(signUp('second@example.com', { invitation: fragment }))
      .withCsrfToken()
    second.assertStatus(400)
    second.assertBody({
      message:
        'This sign-up is not possible. Check the invitation link or ask the admin for a new one',
      code: 'E_REGISTRATION_REJECTED',
    })
  })

  test('test_an_invitation_expires_after_seven_days', async ({ client }) => {
    const clock = freezeTime(NOW)
    const { fragment } = await invite()

    clock.advance({ days: 7 })
    const response = await client
      .post('/api/v1/auth/register')
      .json(signUp('too-late@example.com', { invitation: fragment }))
      .withCsrfToken()

    response.assertStatus(400)
    response.assertBodyContains({ code: 'E_REGISTRATION_REJECTED' })
  })

  test('test_an_invitation_for_an_email_refuses_any_other', async ({ client }) => {
    const { fragment } = await invite('named@example.com')

    const other = await client
      .post('/api/v1/auth/register')
      .json(signUp('someone-else@example.com', { invitation: fragment }))
      .withCsrfToken()
    other.assertStatus(400)

    const named = await client
      .post('/api/v1/auth/register')
      .json(signUp('NAMED@example.com', { invitation: fragment }))
      .withCsrfToken()
    named.assertStatus(201)
  })

  test('test_every_refusal_answers_the_same_so_accounts_cannot_be_enumerated', async ({
    client,
    assert,
  }) => {
    const existing = await UserFactory.create()
    const { fragment } = await invite()
    const attempts = [
      // Registration closed, no invitation.
      signUp('fresh@example.com'),
      // Unknown link.
      signUp('fresh@example.com', { invitation: 'made-up-link-part' }),
      // Valid link, but the email already has an account.
      signUp(existing.email, { invitation: fragment }),
    ]

    const bodies = []
    for (const body of attempts) {
      const response = await client.post('/api/v1/auth/register').json(body).withCsrfToken()
      response.assertStatus(400)
      bodies.push(response.body())
    }
    // Same status and body whatever the reason.
    assert.lengthOf(new Set(bodies.map((body) => JSON.stringify(body))), 1)

    // The link still works for its real invitee: a refused attempt does not consume it.
    const ok = await client
      .post('/api/v1/auth/register')
      .json(signUp('invitee@example.com', { invitation: fragment }))
      .withCsrfToken()
    ok.assertStatus(201)
  })

  test('test_open_registration_needs_no_invitation', async ({ client }) => {
    env.set('REGISTRATION_OPEN', true)

    const response = await client
      .post('/api/v1/auth/register')
      .json(signUp('open@example.com'))
      .withCsrfToken()

    response.assertStatus(201)
    response.assertBodyContains({ user: { email: 'open@example.com', timeZone: 'UTC' } })
  })

  test('test_open_registration_refuses_a_taken_email_with_the_same_error', async ({ client }) => {
    env.set('REGISTRATION_OPEN', true)
    const existing = await UserFactory.create()

    const response = await client
      .post('/api/v1/auth/register')
      .json(signUp(existing.email.toUpperCase()))
      .withCsrfToken()

    response.assertStatus(400)
    response.assertBodyContains({ code: 'E_REGISTRATION_REJECTED' })
  })

  test('test_registration_enforces_the_password_policy_and_the_time_zone', async ({ client }) => {
    env.set('REGISTRATION_OPEN', true)

    const response = await client
      .post('/api/v1/auth/register')
      .json(
        signUp('weak@example.com', {
          password: 'Password-2026!',
          timeZone: '+05:00',
          weekStart: 8,
        })
      )
      .withCsrfToken()

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        { field: 'password', rule: 'passwordTooCommon' },
        { field: 'timeZone', rule: 'timeZone' },
        { field: 'weekStart', rule: 'max' },
      ],
    })
  })

  test('test_a_password_containing_the_email_is_refused', async ({ client }) => {
    env.set('REGISTRATION_OPEN', true)

    const response = await client
      .post('/api/v1/auth/register')
      .json(signUp('lighthouse@example.com', { password: 'my lighthouse key 99' }))
      .withCsrfToken()

    response.assertStatus(422)
    response.assertBodyContains({ errors: [{ field: 'password', rule: 'passwordContainsEmail' }] })
  })

  test('test_guessing_invitation_links_is_throttled_per_ip', async ({ client }) => {
    for (let index = 0; index < 10; index++) {
      const response = await client
        .post('/api/v1/auth/register')
        .json(signUp(`guess-${index}@example.com`, { invitation: `guess-${index}` }))
        .withCsrfToken()
      response.assertStatus(400)
    }

    const blocked = await client
      .post('/api/v1/auth/register')
      .json(signUp('guess-final@example.com', { invitation: 'guess-final' }))
      .withCsrfToken()
    blocked.assertStatus(429)
  })

  test('test_a_stored_invitation_is_bound_to_utc_instants', async ({ assert }) => {
    freezeTime(NOW)
    const { invitation } = await invite()

    assert.equal(
      invitation.expiresAt.toUTC().toISO(),
      DateTime.fromISO(NOW, { zone: 'utc' }).plus({ days: 7 }).toISO()
    )
  })
})
