// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import User from '#models/user'
import Clock from '#services/clock'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import { freezeTime } from '#tests/support/fixed_clock'
import SchedulerRuns from '#scheduler/scheduler_runs'
import { FACTORY_PASSPHRASE, UserFactory } from '#tests/factories/user_factory'

test.group('Accounts / profile', (group) => {
  group.each.setup(() => limiter.clear())

  test('test_the_user_updates_name_language_time_zone_and_week_start', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()

    const response = await client
      .patch('/api/v1/me')
      .json({
        fullName: 'Renamed',
        locale: 'es',
        timeZone: 'Asia/Tokyo',
        weekStart: 7,
        isAdmin: true,
        email: 'hijack@example.com',
      })
      .actingAs(user)

    response.assertStatus(200)
    response.assertBodyContains({
      user: { fullName: 'Renamed', locale: 'es', timeZone: 'Asia/Tokyo', weekStart: 7 },
    })
    await user.refresh()
    assert.equal(user.timeZone, 'Asia/Tokyo')
    // Fields outside the allowlist are ignored.
    assert.isFalse(user.isAdmin)
    assert.notEqual(user.email, 'hijack@example.com')
  })

  test('test_an_invalid_time_zone_or_week_start_is_refused_in_the_users_language', async ({
    client,
  }) => {
    const user = await UserFactory.apply('spanish').create()

    const response = await client
      .patch('/api/v1/me')
      .header('accept-language', 'en')
      .json({ timeZone: 'Mars/Olympus_Mons', weekStart: 0, locale: 'fr' })
      .actingAs(user)

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        { field: 'locale', rule: 'enum' },
        { field: 'timeZone', rule: 'timeZone', message: 'Elige una zona horaria válida' },
        { field: 'weekStart', rule: 'min' },
      ],
    })
  })

  test('test_patch_me_needs_a_session_and_csrf', async ({ client }) => {
    const user = await UserFactory.create()

    const guest = await client.patch('/api/v1/me').json({ fullName: 'x' }).withCsrfToken()
    guest.assertStatus(401)

    const noCsrf = await client
      .patch('/api/v1/me')
      .json({ fullName: 'x' })
      .loginAs(user)
      .withSession({ sv: user.sessionVersion })
    noCsrf.assertStatus(403)
  })
})

test.group('Accounts / password change', (group) => {
  group.each.setup(() => limiter.clear())

  test('test_changing_the_password_keeps_this_session_and_ends_the_others', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const otherDevice = await User.findOrFail(user.id)

    const response = await client
      .put('/api/v1/me/password')
      .json({ currentPassword: FACTORY_PASSPHRASE, password: 'violet glacier tram 31' })
      .actingAs(user)

    response.assertStatus(204)
    response.assertSession('sv', 1)
    await user.refresh()
    assert.isTrue(await user.verifyPassword('violet glacier tram 31'))

    const stale = await client.get('/api/v1/auth/me').actingAs(otherDevice)
    stale.assertStatus(401)
  })

  test('test_a_wrong_current_password_changes_nothing', async ({ client, assert }) => {
    const user = await UserFactory.create()

    const response = await client
      .put('/api/v1/me/password')
      .json({ currentPassword: 'not the right passphrase', password: 'violet glacier tram 31' })
      .actingAs(user)

    response.assertStatus(400)
    response.assertBody({ message: 'The password is not correct', code: 'E_REAUTH_FAILED' })
    await user.refresh()
    assert.isTrue(await user.verifyPassword(FACTORY_PASSPHRASE))
    assert.equal(user.sessionVersion, 0)
  })

  test('test_the_password_recheck_is_throttled_per_user', async ({ client }) => {
    const user = await UserFactory.create()
    const attempt = (currentPassword: string) =>
      client
        .put('/api/v1/me/password')
        .json({ currentPassword, password: 'violet glacier tram 31' })
        .actingAs(user)

    for (let index = 0; index < 5; index++) {
      const response = await attempt('not the right passphrase')
      response.assertStatus(400)
    }
    const blocked = await attempt(FACTORY_PASSPHRASE)
    blocked.assertStatus(429)
  })

  test('test_the_new_password_follows_the_policy_and_cannot_contain_the_email', async ({
    client,
  }) => {
    const user = await UserFactory.merge({ email: 'skyline@example.com' }).create()

    const short = await client
      .put('/api/v1/me/password')
      .json({ currentPassword: FACTORY_PASSPHRASE, password: 'short' })
      .actingAs(user)
    short.assertStatus(422)
    short.assertBodyContains({ errors: [{ field: 'password', rule: 'minLength' }] })

    const withEmail = await client
      .put('/api/v1/me/password')
      .json({ currentPassword: FACTORY_PASSPHRASE, password: 'the skyline at dusk 4' })
      .actingAs(user)
    withEmail.assertStatus(422)
    withEmail.assertBodyContains({
      errors: [{ field: 'password', rule: 'passwordContainsEmail' }],
    })
  })
})

test.group('Accounts / export and deletion', (group) => {
  group.each.setup(() => limiter.clear())
  group.each.teardown(() => app.container.restore(Clock))

  test('test_export_is_a_json_download_of_the_users_own_data_without_secrets', async ({
    client,
    assert,
  }) => {
    freezeTime('2026-03-01T12:00:00Z')
    const admin = await UserFactory.apply('admin').create()
    const created = await client
      .post('/api/v1/admin/invitations')
      .json({ email: 'friend@example.com' })
      .actingAs(admin)
    const linkPart = created.body().url.split('#')[1]

    const response = await client.get('/api/v1/me/export').actingAs(admin)

    response.assertStatus(200)
    response.assertHeader('cache-control', 'no-store')
    assert.include(
      String(response.header('content-disposition')),
      'attachment; filename="monki-focus-export-2026-03-01.json"'
    )
    const body = response.body()
    assert.containsSubset(body, {
      format: 'monki-focus.export',
      version: 1,
      exportedAt: '2026-03-01T12:00:00.000Z',
      user: { id: admin.id, email: admin.email, isAdmin: true },
      twoFactor: { enabled: false, enabledAt: null, recoveryCodesRemaining: 0 },
      invitationsCreated: [{ email: 'friend@example.com', status: 'pending' }],
    })
    const text = JSON.stringify(body)
    assert.notInclude(text, admin.password)
    assert.notInclude(text, linkPart)
    for (const field of ['password', 'tokenHash', 'totpSecretEncrypted', 'sessionVersion']) {
      assert.notInclude(text, `"${field}"`)
    }
  })

  test('test_export_refuses_an_unknown_format', async ({ client }) => {
    const user = await UserFactory.create()

    const response = await client.get('/api/v1/me/export?format=xml').actingAs(user)

    response.assertStatus(422)
    response.assertBodyContains({ errors: [{ field: 'format', rule: 'enum' }] })
  })

  test('test_deleting_the_account_needs_the_password_and_cascades', async ({ client, assert }) => {
    const user = await UserFactory.apply('admin').create()
    const invitee = await UserFactory.create()
    await client.post('/api/v1/admin/invitations').json({}).actingAs(user)
    const accepted = await db
      .table('invitations')
      .insert({
        created_by_user_id: invitee.id,
        token_hash: 'a'.repeat(64),
        expires_at: new Date('2030-01-01T00:00:00Z'),
        used_at: new Date('2026-01-01T00:00:00Z'),
        used_by_user_id: user.id,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('id')
    const clock = await app.container.make(Clock)
    await new SchedulerRuns().claim(
      { job: 'weekly_report', periodKey: '2026-W02', userId: user.id },
      clock.now()
    )

    const refused = await client
      .delete('/api/v1/me')
      .json({ password: 'not the right passphrase' })
      .actingAs(user)
    refused.assertStatus(400)
    refused.assertBodyContains({ code: 'E_REAUTH_FAILED' })
    assert.isNotNull(await User.find(user.id))

    const response = await client
      .delete('/api/v1/me')
      .json({ password: FACTORY_PASSPHRASE })
      .actingAs(user)

    response.assertStatus(204)
    assert.isNull(await User.find(user.id))
    assert.isUndefined(response.session().auth_web)
    const left = await db.from('invitations').where('created_by_user_id', user.id)
    assert.lengthOf(left, 0)
    const runs = await db.from('scheduler_runs').where('user_id', user.id)
    assert.lengthOf(runs, 0)
    // An invitation the deleted user accepted stays with its creator, unlinked.
    const kept = await db.from('invitations').where('id', accepted[0].id).firstOrFail()
    assert.isNull(kept.used_by_user_id)
  })
})
