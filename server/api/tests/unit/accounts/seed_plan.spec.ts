// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { readSeedPlan, type SeedEnv } from '#services/bootstrap/seed_plan'

const STRONG = ['ember', 'violin', 'harbor', 'nine'].join(' ')
const ADMIN: SeedEnv = { SEED_ADMIN_EMAIL: 'Admin@example.com', SEED_ADMIN_PASSWORD: STRONG }

test.group('Seed plan (SEED_* env)', () => {
  test('test_the_admin_comes_from_seed_admin_variables', ({ assert }) => {
    const plan = readSeedPlan({
      ...ADMIN,
      SEED_ADMIN_NAME: ' The admin ',
      SEED_ADMIN_LOCALE: 'es',
      SEED_ADMIN_TIME_ZONE: 'Europe/Madrid',
    })

    assert.deepEqual(plan, {
      admin: {
        email: 'admin@example.com',
        fullName: 'The admin',
        password: STRONG,
        locale: 'es',
        timeZone: 'Europe/Madrid',
      },
      smoke: null,
    })
  })

  test('test_defaults_are_english_and_utc', ({ assert }) => {
    const plan = readSeedPlan(ADMIN)

    assert.containsSubset(plan.admin, { fullName: null, locale: 'en', timeZone: 'UTC' })
  })

  test('test_a_weak_admin_password_is_refused_without_echoing_it', ({ assert }) => {
    try {
      readSeedPlan({ ...ADMIN, SEED_ADMIN_PASSWORD: 'Password-2026!' })
      assert.fail('a weak password must be refused')
    } catch (error) {
      const message = (error as Error).message
      assert.include(message, 'SEED_ADMIN_PASSWORD is too weak (too_common)')
      assert.notInclude(message, 'Password-2026!')
    }
  })

  test('test_half_a_credential_pair_is_refused', ({ assert }) => {
    assert.throws(
      () => readSeedPlan({ SEED_ADMIN_EMAIL: 'admin@example.com' }),
      /both SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD/
    )
    assert.throws(
      () => readSeedPlan({ ...ADMIN, SMOKE_PASSWORD: STRONG }),
      /both SMOKE_EMAIL and SMOKE_PASSWORD/
    )
  })

  test('test_nothing_to_seed_is_an_error', ({ assert }) => {
    assert.throws(() => readSeedPlan({ SEED_ADMIN_EMAIL: '  ' }), /nothing to seed/)
  })

  test('test_the_smoke_user_can_never_be_the_admin', ({ assert }) => {
    assert.throws(
      () => readSeedPlan({ ...ADMIN, SMOKE_EMAIL: 'admin@example.com', SMOKE_PASSWORD: STRONG }),
      /SMOKE_EMAIL must differ/
    )
  })

  test('test_an_unknown_time_zone_or_locale_is_refused', ({ assert }) => {
    assert.throws(
      () => readSeedPlan({ ...ADMIN, SEED_ADMIN_TIME_ZONE: '+02:00' }),
      /SEED_ADMIN_TIME_ZONE/
    )
    assert.throws(() => readSeedPlan({ ...ADMIN, SEED_ADMIN_LOCALE: 'fr' }), /SEED_ADMIN_LOCALE/)
  })
})
