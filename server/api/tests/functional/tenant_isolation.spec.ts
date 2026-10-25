// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import type User from '#models/user'
import Clock from '#services/clock'
import Invitation from '#models/invitation'
import app from '@adonisjs/core/services/app'
import router from '@adonisjs/core/services/router'
import limiter from '@adonisjs/limiter/services/main'
import { UserFactory } from '#tests/factories/user_factory'
import InvitationService from '#services/accounts/invitation_service'

/**
 * Another user's resource answers 404 (never 403, which would confirm that
 * the id exists) and stays untouched. One case per route with a `:param`;
 * the guard test fails when a route with a param has no case here, so
 * every later package (devices, guardian links, unlock requests...) adds
 * its own. The attacker is an admin, so even admin-only routes are scoped
 * by owner, not only by role.
 */

interface Victim {
  user: User
  invitation: Invitation
}

interface IsolationCase {
  route: string
  method: 'get' | 'post' | 'put' | 'patch' | 'delete'
  url: (victim: Victim) => string
  body?: Record<string, unknown>
  /** Proves the victim's row survived. */
  untouched: (victim: Victim) => Promise<boolean>
}

const cases: IsolationCase[] = [
  {
    route: 'v1.admin.invitations.destroy',
    method: 'delete',
    url: (victim) => `/api/v1/admin/invitations/${victim.invitation.id}`,
    untouched: async (victim) => (await Invitation.find(victim.invitation.id)) !== null,
  },
]

/** Routes whose params are not ids of a user's rows (none yet). Each needs a reason. */
const NOT_ID_SCOPED = new Map<string, string>()

async function aVictim(): Promise<Victim> {
  const user = await UserFactory.apply('admin').create()
  const clock = await app.container.make(Clock)
  const { invitation } = await new InvitationService().create(user, null, clock.now())
  return { user, invitation }
}

test.group('Tenant isolation', (group) => {
  group.each.setup(() => limiter.clear())

  test('test_another_users_resource_answers_404 ({$self.route})')
    .with(cases)
    .run(async ({ client, assert }, entry) => {
      const victim = await aVictim()
      const attacker = await UserFactory.apply('admin').create()

      const request = client[entry.method](entry.url(victim))
      const response = await (entry.body ? request.json(entry.body) : request).actingAs(attacker)

      response.assertStatus(404)
      response.assertBody({ message: 'Not found', code: 'E_ROW_NOT_FOUND' })
      assert.isTrue(await entry.untouched(victim), 'the victim row is untouched')

      // The owner still reaches it: the case really points at an existing row.
      const own = client[entry.method](entry.url(victim))
      const ownResponse = await (entry.body ? own.json(entry.body) : own).actingAs(victim.user)
      assert.isBelow(ownResponse.status(), 300)
    })

  test('test_the_isolation_dataset_covers_every_route_with_a_param', ({ assert }) => {
    const routes = Object.values(router.toJSON()).flat()
    const withParams = routes
      .filter((route) => route.pattern.startsWith('/api/') && route.pattern.includes('/:'))
      .map((route) => route.name ?? route.pattern)
      .filter((name) => !NOT_ID_SCOPED.has(name))

    assert.sameMembers(
      [...new Set(withParams)].sort(),
      [...new Set(cases.map((entry) => entry.route))].sort(),
      'Every route with a :param needs a tenant isolation case (or a reason in NOT_ID_SCOPED)'
    )
  })

  test('test_a_malformed_id_is_a_404_not_a_server_error', async ({ client }) => {
    const admin = await UserFactory.apply('admin').create()

    const response = await client.delete('/api/v1/admin/invitations/not-a-number').actingAs(admin)

    response.assertStatus(404)
  })

  test('test_lists_and_the_export_only_show_the_users_own_rows', async ({ client, assert }) => {
    const victim = await aVictim()
    const attacker = await UserFactory.apply('admin').create()

    const list = await client.get('/api/v1/admin/invitations').actingAs(attacker)
    list.assertStatus(200)
    assert.deepEqual(list.body().invitations, [])

    const exported = await client.get('/api/v1/me/export').actingAs(attacker)
    exported.assertStatus(200)
    assert.deepEqual(exported.body().invitationsCreated, [])
    assert.notInclude(JSON.stringify(exported.body()), victim.user.email)
  })
})
