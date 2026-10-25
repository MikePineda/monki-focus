// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import Clock from '#services/clock'
import User from '#models/user'
import Invitation from '#models/invitation'
import InvitationService from '#services/accounts/invitation_service'
import { FACTORY_PASSPHRASE, UserFactory } from '#tests/factories/user_factory'
import { expectStatus } from '#tests/support/expect_response'
import { newPairingCode } from '#tests/support/guardians'
import { bootKeys } from '#tests/support/device_api'

const REFUSED = {
  message:
    'This account was created to guard someone. Ask the admin for an invitation to protect your own devices',
  code: 'E_GUARDIAN_ONLY_ACCOUNT',
}

/** A ward's code, then a new guardian account through it; answers that account. */
async function guardianOnlyAccount(client: ApiClient, email = 'guardian-only@example.com') {
  const ward = await UserFactory.create()
  const { code } = await newPairingCode(client, ward)
  const response = await client
    .post('/api/v1/auth/register-guardian')
    .json({ code, email, fullName: 'Guardian only', password: FACTORY_PASSPHRASE })
    .withCsrfToken()
  response.assertStatus(201)
  return User.findByOrFail('email', email)
}

async function invitationFor(email: string | null) {
  const admin = await UserFactory.apply('admin').create()
  const clock = await app.container.make(Clock)
  const { invitation, url } = await new InvitationService().create(admin, email, clock.now())
  return { invitation, secret: url.split('#')[1] }
}

/**
 * A pairing code opens a sign-up while registration is closed, but only to
 * guard someone: the account it creates cannot become a ward (no pairing
 * codes of its own, no devices) and so cannot chain more sign-ups. An
 * admin's invitation, or opening registration, lifts it.
 */
test.group('Guardian-only accounts', (group) => {
  group.each.setup(async () => {
    await limiter.clear()
    await bootKeys()
  })
  group.each.teardown(() => env.set('REGISTRATION_OPEN', false))

  test('test_an_account_made_through_a_pairing_code_is_guardian_only', async ({
    client,
    assert,
  }) => {
    const guardian = await guardianOnlyAccount(client)
    const me = await client.get('/api/v1/auth/me').actingAs(guardian)

    assert.isTrue(guardian.guardianOnly)
    assert.isTrue(me.body().user.guardianOnly)
  })

  test('test_a_guardian_only_account_cannot_mint_pairing_codes_while_registration_is_closed', async ({
    client,
  }) => {
    const guardian = await guardianOnlyAccount(client)

    const response = await client.post('/api/v1/guardian/pairing-codes').actingAs(guardian)

    response.assertStatus(403)
    response.assertBody(REFUSED)
  })

  test('test_a_guardian_only_account_cannot_enrol_devices_while_registration_is_closed', async ({
    client,
  }) => {
    const guardian = await guardianOnlyAccount(client)

    const response = await client.post('/api/v1/devices/enrollment-codes').actingAs(guardian)

    response.assertStatus(403)
    response.assertBody(REFUSED)
  })

  test('test_opening_registration_lifts_it', async ({ client }) => {
    const guardian = await guardianOnlyAccount(client)
    env.set('REGISTRATION_OPEN', true)

    await expectStatus(client.post('/api/v1/guardian/pairing-codes').actingAs(guardian), 201)
    await expectStatus(client.post('/api/v1/devices/enrollment-codes').actingAs(guardian), 201)
  })

  test('test_an_admin_invitation_lifts_it_for_good', async ({ client, assert }) => {
    const guardian = await guardianOnlyAccount(client)
    const { invitation, secret } = await invitationFor(guardian.email)

    const accepted = await client
      .post('/api/v1/me/invitation')
      .json({ invitation: secret })
      .actingAs(guardian)

    accepted.assertStatus(200)
    assert.isFalse(accepted.body().user.guardianOnly)
    await guardian.refresh()
    assert.isFalse(guardian.guardianOnly)
    await invitation.refresh()
    assert.equal(invitation.usedByUserId, guardian.id)
    await expectStatus(client.post('/api/v1/guardian/pairing-codes').actingAs(guardian), 201)
  })

  test('test_a_bad_or_foreign_invitation_lifts_nothing', async ({ client, assert }) => {
    const guardian = await guardianOnlyAccount(client)
    const foreign = await invitationFor('someone-else@example.com')

    for (const secret of ['not-a-real-invitation', foreign.secret]) {
      const response = await client
        .post('/api/v1/me/invitation')
        .json({ invitation: secret })
        .actingAs(guardian)
      response.assertStatus(400)
      response.assertBodyContains({ code: 'E_REGISTRATION_REJECTED' })
    }
    await guardian.refresh()
    assert.isTrue(guardian.guardianOnly)
    const untouched = await Invitation.findOrFail(foreign.invitation.id)
    assert.isNull(untouched.usedAt)
  })

  test('test_an_ordinary_account_never_spends_an_invitation', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const { invitation, secret } = await invitationFor(null)

    const response = await client
      .post('/api/v1/me/invitation')
      .json({ invitation: secret })
      .actingAs(user)

    response.assertStatus(200)
    await invitation.refresh()
    assert.isNull(invitation.usedAt)
  })

  test('test_ordinary_accounts_keep_starting_protection_while_registration_is_closed', async ({
    client,
  }) => {
    const user = await UserFactory.create()

    await expectStatus(client.post('/api/v1/guardian/pairing-codes').actingAs(user), 201)
    await expectStatus(client.post('/api/v1/devices/enrollment-codes').actingAs(user), 201)
  })
})
