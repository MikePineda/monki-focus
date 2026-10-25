// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { pairingRefusal } from '#domain/guardians/pairing_eligibility'
import { activationRefusal } from '#domain/guardians/link_activation'
import {
  PENDING_LINK_TTL_HOURS,
  grantsGuardianship,
  grantsVisibility,
  linkState,
} from '#domain/guardians/link_state'
import {
  DEFAULT_WARD_REVOCATION_COOLDOWN_HOURS,
  canCancelRevocation,
  planRevocation,
  wardRevocationCooldownHours,
} from '#domain/guardians/link_revocation'
import {
  DEFAULT_MAX_UNLOCK_MINUTES,
  defaultMaxUnlockMinutes,
  maxUnlockMinutesCap,
} from '#domain/guardians/link_settings'

const T0 = new Date('2026-01-05T09:00:00Z')
const hours = (count: number) => new Date(T0.getTime() + count * 3_600_000)

const active = { status: 'active' as const, revocationEffectiveAt: null, createdAt: T0 }
const pending = { status: 'pending' as const, revocationEffectiveAt: null, createdAt: T0 }

test.group('Pairing eligibility', () => {
  test('test_ward_cannot_pair_with_self', ({ assert }) => {
    assert.equal(
      pairingRefusal({ wardUserId: 7, guardianUserId: 7, pairAlreadyLinked: false }),
      'self'
    )
  })

  test('test_a_pair_has_at_most_one_live_link', ({ assert }) => {
    assert.equal(
      pairingRefusal({ wardUserId: 7, guardianUserId: 8, pairAlreadyLinked: true }),
      'already_linked'
    )
    assert.isNull(pairingRefusal({ wardUserId: 7, guardianUserId: 8, pairAlreadyLinked: false }))
  })
})

test.group('Link state', () => {
  test('test_a_pending_link_grants_nothing', ({ assert }) => {
    assert.equal(linkState(pending, T0), 'pending')
    assert.isFalse(grantsGuardianship(linkState(pending, T0)))
  })

  test('test_an_active_link_grants_guardianship_until_its_revocation_takes_effect', ({
    assert,
  }) => {
    const revoking = { status: 'active' as const, revocationEffectiveAt: hours(24), createdAt: T0 }

    assert.isTrue(grantsGuardianship(linkState(active, T0)))
    assert.equal(linkState(revoking, hours(23)), 'revoking')
    assert.isTrue(grantsGuardianship(linkState(revoking, hours(23))))
  })

  test('test_a_link_past_its_revocation_time_is_revoked_even_before_the_job_runs', ({ assert }) => {
    const revoking = { status: 'active' as const, revocationEffectiveAt: hours(24), createdAt: T0 }

    assert.equal(linkState(revoking, hours(24)), 'revoked')
    assert.isFalse(grantsGuardianship(linkState(revoking, hours(24))))
    assert.equal(
      linkState({ status: 'revoked', revocationEffectiveAt: null, createdAt: T0 }, T0),
      'revoked'
    )
  })
})

test.group('Link lifetime and visibility', () => {
  test('test_a_pending_link_lapses_after_24_hours', ({ assert }) => {
    assert.equal(PENDING_LINK_TTL_HOURS, 24)
    assert.equal(linkState(pending, hours(23)), 'pending')
    assert.equal(linkState(pending, hours(24)), 'revoked')
    assert.equal(linkState(active, hours(24 * 30)), 'active', 'an active link never lapses')
  })

  test('test_a_revoking_link_hides_the_summary_but_keeps_approvals', ({ assert }) => {
    assert.isTrue(grantsVisibility('active'))
    for (const state of ['pending', 'revoking', 'revoked'] as const) {
      assert.isFalse(grantsVisibility(state), state)
    }
    assert.isTrue(grantsGuardianship('revoking'), 'unlock approvals last until the deadline')
    assert.isFalse(grantsGuardianship('pending'))
  })
})

test.group('Link activation', () => {
  test('test_link_needs_the_guardians_two_factor_before_it_is_active', ({ assert }) => {
    assert.equal(
      activationRefusal({ state: 'pending', guardianTwoFactorEnabled: false }),
      'guardian_two_factor_required'
    )
    assert.isNull(activationRefusal({ state: 'pending', guardianTwoFactorEnabled: true }))
  })

  test('test_only_a_pending_link_can_be_confirmed', ({ assert }) => {
    for (const state of ['active', 'revoking', 'revoked'] as const) {
      assert.equal(activationRefusal({ state, guardianTwoFactorEnabled: true }), 'not_pending')
    }
  })
})

test.group('Link revocation', () => {
  test('test_guardian_revocation_is_immediate', ({ assert }) => {
    for (const state of ['pending', 'active', 'revoking'] as const) {
      assert.deepEqual(planRevocation({ by: 'guardian', state, now: T0, cooldownHours: 24 }), {
        kind: 'immediate',
      })
    }
  })

  test('test_ward_revocation_takes_effect_after_24h', ({ assert }) => {
    assert.equal(DEFAULT_WARD_REVOCATION_COOLDOWN_HOURS, 24)
    assert.equal(wardRevocationCooldownHours(undefined), 24)
    assert.deepEqual(
      planRevocation({
        by: 'ward',
        state: 'active',
        now: T0,
        cooldownHours: wardRevocationCooldownHours(undefined),
      }),
      { kind: 'scheduled', effectiveAt: hours(24) }
    )
  })

  test('test_a_second_ward_request_keeps_the_first_deadline', ({ assert }) => {
    assert.deepEqual(
      planRevocation({ by: 'ward', state: 'revoking', now: T0, cooldownHours: 24 }),
      {
        kind: 'already_scheduled',
      }
    )
  })

  test('test_ward_can_leave_a_pending_link_at_once', ({ assert }) => {
    assert.deepEqual(planRevocation({ by: 'ward', state: 'pending', now: T0, cooldownHours: 24 }), {
      kind: 'immediate',
    })
  })

  test('test_zero_cooldown_makes_the_wards_revocation_immediate', ({ assert }) => {
    assert.equal(wardRevocationCooldownHours(0), 0)
    assert.deepEqual(planRevocation({ by: 'ward', state: 'active', now: T0, cooldownHours: 0 }), {
      kind: 'immediate',
    })
  })

  test('test_only_the_ward_cancels_a_pending_revocation', ({ assert }) => {
    assert.isTrue(canCancelRevocation('ward', 'revoking'))
    assert.isFalse(canCancelRevocation('guardian', 'revoking'))
    assert.isFalse(canCancelRevocation('ward', 'active'))
    assert.isFalse(canCancelRevocation('ward', 'revoked'))
  })

  test('test_a_revoked_link_cannot_be_revoked_again', ({ assert }) => {
    for (const by of ['ward', 'guardian'] as const) {
      assert.deepEqual(planRevocation({ by, state: 'revoked', now: T0, cooldownHours: 24 }), {
        kind: 'already_revoked',
      })
    }
  })
})

test.group('Link settings', () => {
  test('test_default_max_unlock_is_thirty_minutes_capped_by_the_instance', ({ assert }) => {
    assert.equal(DEFAULT_MAX_UNLOCK_MINUTES, 30)
    assert.equal(maxUnlockMinutesCap(undefined), 120)
    assert.equal(maxUnlockMinutesCap(20), 20)
    assert.equal(maxUnlockMinutesCap(1000), 240)
    assert.equal(defaultMaxUnlockMinutes(maxUnlockMinutesCap(undefined)), 30)
    assert.equal(defaultMaxUnlockMinutes(maxUnlockMinutesCap(20)), 20)
  })
})
