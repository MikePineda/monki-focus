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
import Device from '#models/device'
import { enrolledDevice } from '#tests/factories/device_factory'

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
  device: Device
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
  {
    route: 'v1.devices.update',
    method: 'patch',
    url: (victim) => `/api/v1/devices/${victim.device.uuid}`,
    body: { name: 'Renamed by someone else', deadmanHours: 48 },
    untouched: async (victim) => {
      const device = await Device.findOrFail(victim.device.id)
      return device.name === victim.device.name && device.deadmanHours === 6
    },
  },
  {
    route: 'v1.devices.destroy',
    method: 'delete',
    url: (victim) => `/api/v1/devices/${victim.device.uuid}`,
    untouched: async (victim) => {
      const device = await Device.findOrFail(victim.device.id)
      const tokens = await Device.accessTokens.all(device)
      return device.revokedAt === null && tokens.length === 1
    },
  },
]

/** Routes whose params are not ids of a user's rows (none yet). Each needs a reason. */
const NOT_ID_SCOPED = new Map<string, string>()

async function aVictim(): Promise<Victim> {
  const user = await UserFactory.apply('admin').create()
  const clock = await app.container.make(Clock)
  const { invitation } = await new InvitationService().create(user, null, clock.now())
  const { device } = await enrolledDevice(user)
  return { user, invitation, device }
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
    const device = await client.delete('/api/v1/devices/not-a-uuid').actingAs(admin)
    const upper = await client
      .patch('/api/v1/devices/6F1C2D3E-4B5A-4C6D-8E7F-90A1B2C3D4E5')
      .json({ name: 'x' })
      .actingAs(admin)

    response.assertStatus(404)
    device.assertStatus(404)
    upper.assertStatus(404)
  })

  test('test_lists_and_the_export_only_show_the_users_own_rows', async ({ client, assert }) => {
    const victim = await aVictim()
    const attacker = await UserFactory.apply('admin').create()

    const list = await client.get('/api/v1/admin/invitations').actingAs(attacker)
    list.assertStatus(200)
    assert.deepEqual(list.body().invitations, [])

    const devices = await client.get('/api/v1/devices').actingAs(attacker)
    devices.assertStatus(200)
    assert.deepEqual(devices.body().devices, [])

    const exported = await client.get('/api/v1/me/export').actingAs(attacker)
    exported.assertStatus(200)
    assert.deepEqual(exported.body().invitationsCreated, [])
    assert.deepEqual(exported.body().devices, [])
    assert.deepEqual(exported.body().bypassEvents, [])
    assert.notInclude(JSON.stringify(exported.body()), victim.user.email)
    assert.notInclude(JSON.stringify(exported.body()), victim.device.uuid)
  })
})
