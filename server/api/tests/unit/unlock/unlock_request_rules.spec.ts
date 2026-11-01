// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { cancelRequest, decideRequest, effectiveStatus } from '#domain/unlock/unlock_request_state'
import { grantedMinutes, minutesCeiling } from '#domain/unlock/unlock_minutes'
import {
  ACTION_TOKEN_LIFETIME_SECONDS,
  actionHashesMatch,
  actionTokenExpiresAt,
  actionTokenFromBytes,
  actionTokenHash,
  isActionToken,
  isActionUsable,
} from '#domain/unlock/action_token'
import { checkUnlockScope } from '#domain/unlock/unlock_scope'

const NOW = new Date('2026-01-05T09:00:00Z')
const LATER = new Date('2026-01-05T09:20:00Z')
const pending = { status: 'pending' as const, expiresAt: new Date('2026-01-05T09:15:00Z') }

test.group('unlock request state machine', () => {
  test('test_a_pending_request_is_approved_or_denied_once', ({ assert }) => {
    assert.deepEqual(decideRequest(pending, 'approve', NOW), { ok: true, value: 'approved' })
    assert.deepEqual(decideRequest(pending, 'deny', NOW), { ok: true, value: 'denied' })
  })

  test('test_second_decision_is_rejected', ({ assert }) => {
    for (const status of ['approved', 'denied', 'cancelled', 'expired'] as const) {
      const decided = { ...pending, status }
      assert.deepEqual(decideRequest(decided, 'approve', NOW), {
        ok: false,
        reason: 'already_decided',
      })
      assert.deepEqual(decideRequest(decided, 'deny', NOW), {
        ok: false,
        reason: 'already_decided',
      })
    }
  })

  test('test_decision_after_expiry_is_rejected', ({ assert }) => {
    assert.deepEqual(decideRequest(pending, 'approve', LATER), { ok: false, reason: 'expired' })
    assert.deepEqual(decideRequest(pending, 'approve', pending.expiresAt), {
      ok: false,
      reason: 'expired',
    })
  })

  test('test_a_pending_request_past_its_deadline_reads_as_expired', ({ assert }) => {
    assert.equal(effectiveStatus(pending, NOW), 'pending')
    assert.equal(effectiveStatus(pending, LATER), 'expired')
    assert.equal(effectiveStatus({ ...pending, status: 'approved' }, LATER), 'approved')
  })

  test('test_only_a_pending_request_can_be_cancelled', ({ assert }) => {
    assert.deepEqual(cancelRequest(pending, NOW), { ok: true, value: 'cancelled' })
    assert.deepEqual(cancelRequest(pending, LATER), { ok: false, reason: 'already_closed' })
    assert.deepEqual(cancelRequest({ ...pending, status: 'approved' }, NOW), {
      ok: false,
      reason: 'already_closed',
    })
  })
})

test.group('unlock minutes', () => {
  test('test_minutes_are_capped_by_guardian_max', ({ assert }) => {
    assert.equal(grantedMinutes({ requested: 60, linkMax: 30, ceiling: 120 }), 30)
    assert.equal(grantedMinutes({ requested: 15, linkMax: 30, ceiling: 120 }), 15)
    assert.equal(grantedMinutes({ requested: 15, approved: 45, linkMax: 30, ceiling: 120 }), 30)
    assert.equal(grantedMinutes({ requested: 60, approved: 5, linkMax: 30, ceiling: 120 }), 5)
  })

  test('test_minutes_never_exceed_the_protocol_or_instance_ceiling', ({ assert }) => {
    assert.equal(grantedMinutes({ requested: 120, linkMax: 240, ceiling: 120 }), 120)
    assert.equal(minutesCeiling(4 * 3600), 120)
    assert.equal(minutesCeiling(30 * 60), 30)
    assert.equal(
      grantedMinutes({ requested: 120, linkMax: 240, ceiling: minutesCeiling(1800) }),
      30
    )
  })
})

test.group('action tokens', () => {
  test('test_action_token_carries_256_bits_as_unpadded_base64url', ({ assert }) => {
    const token = actionTokenFromBytes(new Uint8Array(32).fill(1))

    assert.isTrue(isActionToken(token))
    assert.lengthOf(token, 43)
    assert.throws(() => actionTokenFromBytes(new Uint8Array(31)), RangeError)
    assert.isFalse(isActionToken('short'))
    assert.isFalse(isActionToken(`${token}=`))
  })

  test('test_only_the_sha256_of_an_action_token_is_kept', ({ assert }) => {
    const token = actionTokenFromBytes(new Uint8Array(32).fill(2))
    const hash = actionTokenHash(token)

    assert.match(hash, /^[0-9a-f]{64}$/)
    assert.notInclude(hash, token)
    assert.isTrue(actionHashesMatch(hash, actionTokenHash(token)))
    assert.isFalse(actionHashesMatch(hash, actionTokenHash(`${token.slice(0, -1)}A`)))
    assert.isFalse(actionHashesMatch(hash, null))
    assert.isFalse(actionHashesMatch(hash, 'abc'))
  })

  test('test_action_token_lives_15_minutes', ({ assert }) => {
    const expiresAt = actionTokenExpiresAt(NOW)

    assert.equal(ACTION_TOKEN_LIFETIME_SECONDS, 900)
    assert.equal(expiresAt.toISOString(), '2026-01-05T09:15:00.000Z')
    assert.isTrue(isActionUsable(expiresAt, NOW))
    assert.isFalse(isActionUsable(expiresAt, expiresAt))
    assert.isFalse(isActionUsable(null, NOW))
  })
})

test.group('unlock scope', () => {
  test('test_domain_path_and_app_scopes_are_accepted', ({ assert }) => {
    assert.deepEqual(
      checkUnlockScope({ kind: 'domain', value: 'example.com', includeSubdomains: false }),
      { ok: true, value: { kind: 'domain', value: 'example.com', includeSubdomains: false } }
    )
    assert.isTrue(checkUnlockScope({ kind: 'path', value: 'example.com/watch' }).ok)
    assert.isTrue(checkUnlockScope({ kind: 'app', value: 'com.example.app' }).ok)
  })

  test('test_rule_scope_is_out_of_v1', ({ assert }) => {
    assert.deepEqual(checkUnlockScope({ kind: 'rule', value: 'feed' }), {
      ok: false,
      reason: 'scope_kind',
    })
  })

  test('test_malformed_scope_values_are_rejected', ({ assert }) => {
    assert.isFalse(checkUnlockScope({ kind: 'domain', value: '*.example.com' }).ok)
    assert.isFalse(checkUnlockScope({ kind: 'domain', value: 'example.com' }).ok)
    assert.isFalse(checkUnlockScope({ kind: 'path', value: 'example.com/../x' }).ok)
    assert.isFalse(checkUnlockScope({ kind: 'app', value: 'nodots' }).ok)
    assert.isFalse(checkUnlockScope({ kind: 'domain', value: 'a'.repeat(300) }).ok)
  })
})
