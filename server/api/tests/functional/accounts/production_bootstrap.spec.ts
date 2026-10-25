// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import env from '#start/env'
import User from '#models/user'
import { FACTORY_PASSPHRASE, UserFactory } from '#tests/factories/user_factory'
import ProductionBootstrap from '#services/bootstrap/production_bootstrap'
import ProductionBootstrapSeeder from '#database/seeders/production_bootstrap_seeder'
import db from '@adonisjs/lucid/services/db'
import { Secret } from '@adonisjs/core/helpers'

const STRONG = ['ember', 'violin', 'harbor', 'nine'].join(' ')
const SEED_VARIABLES = ['SEED_USERS', 'SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD'] as const

function seedUser(email: string) {
  return { email, fullName: null, password: STRONG, locale: 'en' as const, timeZone: 'UTC' }
}

test.group('Production bootstrap', (group) => {
  const saved = new Map<string, unknown>()
  group.each.setup(() => {
    for (const name of SEED_VARIABLES) saved.set(name, env.get(name))
  })
  group.each.teardown(() => {
    for (const name of SEED_VARIABLES) env.set(name, saved.get(name) as never)
  })

  test('test_the_first_admin_is_created_once_and_re_runs_change_nothing', async ({ assert }) => {
    const plan = { admin: seedUser('admin@example.com'), smoke: seedUser('smoke@example.com') }

    const first = await new ProductionBootstrap().run(plan)
    const again = await new ProductionBootstrap().run(plan)

    assert.equal(again.admin!.id, first.admin!.id)
    const admin = await User.findByOrFail('email', 'admin@example.com')
    assert.isTrue(admin.isAdmin)
    assert.isTrue(await admin.verifyPassword(STRONG))
    const smoke = await User.findByOrFail('email', 'smoke@example.com')
    assert.isFalse(smoke.isAdmin, 'the smoke user is never an admin')
    assert.lengthOf(await User.all(), 2)
  })

  test('test_an_existing_account_with_the_admin_email_and_password_is_promoted', async ({
    assert,
  }) => {
    const existing = await UserFactory.merge({
      email: 'promote@example.com',
      password: STRONG,
    }).create()

    await new ProductionBootstrap().run({ admin: seedUser('promote@example.com'), smoke: null })

    await existing.refresh()
    assert.isTrue(existing.isAdmin)
  })

  test('test_an_existing_account_with_another_password_is_never_taken_over', async ({ assert }) => {
    // Someone registered the admin email first, with their own password.
    const existing = await UserFactory.merge({ email: 'taken@example.com' }).create()

    try {
      await new ProductionBootstrap().run({ admin: seedUser('taken@example.com'), smoke: null })
      assert.fail('a mismatched SEED_ADMIN_PASSWORD must stop the bootstrap')
    } catch (error) {
      const message = (error as Error).message
      assert.include(message, 'SEED_ADMIN_PASSWORD does not match')
      assert.include(message, 'user:reset-password')
      assert.notInclude(message, 'taken@example.com')
      assert.notInclude(message, STRONG)
    }

    await existing.refresh()
    assert.isFalse(existing.isAdmin)
    assert.isTrue(await existing.verifyPassword(FACTORY_PASSPHRASE), 'its password is untouched')
  })

  test('test_the_seeder_does_nothing_while_seed_users_is_off', async ({ assert }) => {
    env.set('SEED_USERS', false)
    env.set('SEED_ADMIN_EMAIL', 'admin@example.com')

    await new ProductionBootstrapSeeder(db.connection()).run()

    assert.lengthOf(await User.all(), 0)
  })

  test('test_the_seeder_creates_the_admin_from_env', async ({ assert }) => {
    env.set('SEED_USERS', true)
    env.set('SEED_ADMIN_EMAIL', 'admin@example.com')
    env.set('SEED_ADMIN_PASSWORD', new Secret(STRONG))

    await new ProductionBootstrapSeeder(db.connection()).run()

    const admin = await User.findByOrFail('email', 'admin@example.com')
    assert.isTrue(admin.isAdmin)
  })

  test('test_the_seeder_refuses_a_weak_password', async ({ assert }) => {
    env.set('SEED_USERS', true)
    env.set('SEED_ADMIN_EMAIL', 'admin@example.com')
    env.set('SEED_ADMIN_PASSWORD', new Secret('admin1234567'))

    await assert.rejects(
      () => new ProductionBootstrapSeeder(db.connection()).run(),
      /SEED_ADMIN_PASSWORD is too weak/
    )
    assert.lengthOf(await User.all(), 0)
  })
})
