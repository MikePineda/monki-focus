// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { checkKeyPins, pinnedSetFingerprint } from '#domain/devices/key_pin_check'
import {
  gapSeconds,
  isDeadmanHours,
  isOverdue,
  overdueAt,
  wasAnnounced,
  type DeadmanSubject,
} from '#domain/devices/deadman_rule'
import { isRotationDue, previousTokenValidUntil } from '#domain/devices/token_rotation'
import { checkBypassDetails } from '#domain/devices/bypass_event_details'
import { clientDedupeKey, serverDedupeKey } from '#domain/devices/bypass_dedupe_key'
import { clockOffsetMs } from '#domain/devices/clock_offset'
import { isDeviceName } from '#domain/devices/device_name'
import { hasRoomForAnotherDevice, MAX_ACTIVE_DEVICES } from '#domain/devices/device_quota'
import { CLIENT_BYPASS_KINDS, SERVER_BYPASS_KINDS } from '#domain/devices/bypass_event_kinds'

const HOUR = 3600
const T0 = 1_767_603_600 // 2026-01-05T09:00:00Z

const published = { unlock: ['UNLOCKnewKid0001', 'UNLOCKoldKid0001'], policy: ['POLICYkid0000001'] }

function subject(overrides: Partial<DeadmanSubject> = {}): DeadmanSubject {
  return {
    protectionActive: true,
    revoked: false,
    lastSeenAt: T0,
    deadmanHours: 6,
    announcedOfflineAt: null,
    ...overrides,
  }
}

test.group('Key pin check', () => {
  test('test_pinning_published_keys_including_a_retired_one_matches', ({ assert }) => {
    const verdict = checkKeyPins(
      { unlock: ['UNLOCKoldKid0001'], policy: ['POLICYkid0000001'] },
      published
    )

    assert.isFalse(verdict.mismatch)
    assert.deepEqual(verdict.unknown, { unlock: [], policy: [] })
  })

  test('test_a_kid_the_instance_never_published_is_a_mismatch', ({ assert }) => {
    const verdict = checkKeyPins(
      { unlock: ['UNLOCKnewKid0001', 'PROXYkid00000001'], policy: ['POLICYkid0000001'] },
      published
    )

    assert.isTrue(verdict.mismatch)
    assert.deepEqual(verdict.unknown, { unlock: ['PROXYkid00000001'], policy: [] })
  })

  test('test_a_key_pinned_for_the_wrong_purpose_is_a_mismatch', ({ assert }) => {
    const verdict = checkKeyPins(
      { unlock: ['UNLOCKnewKid0001'], policy: ['UNLOCKnewKid0001'] },
      published
    )

    assert.isTrue(verdict.mismatch)
    assert.deepEqual(verdict.unknown.policy, ['UNLOCKnewKid0001'])
  })

  test('test_the_fingerprint_ignores_order_and_duplicates', ({ assert }) => {
    const a = pinnedSetFingerprint({ unlock: ['b', 'a'], policy: ['c'] })
    const b = pinnedSetFingerprint({ unlock: ['a', 'b', 'a'], policy: ['c'] })
    const c = pinnedSetFingerprint({ unlock: ['a'], policy: ['b', 'c'] })

    assert.equal(a, b)
    assert.notEqual(a, c)
    assert.match(a, /^[A-Za-z0-9_-]{16}$/)
  })
})

test.group('Dead-man rule', () => {
  test('test_device_without_active_protection_never_triggers', ({ assert }) => {
    assert.isFalse(isOverdue(subject({ protectionActive: false }), T0 + 100 * HOUR))
  })

  test('test_a_revoked_device_never_triggers', ({ assert }) => {
    assert.isFalse(isOverdue(subject({ revoked: true }), T0 + 100 * HOUR))
  })

  test('test_gap_longer_than_threshold_triggers_at_the_exact_threshold', ({ assert }) => {
    assert.equal(overdueAt(subject()), T0 + 6 * HOUR)
    assert.isFalse(isOverdue(subject(), T0 + 6 * HOUR - 1))
    assert.isTrue(isOverdue(subject(), T0 + 6 * HOUR))
    assert.isTrue(isOverdue(subject({ deadmanHours: 1 }), T0 + HOUR))
  })

  test('test_announced_offline_still_alerts_flagged', ({ assert }) => {
    const announced = subject({ announcedOfflineAt: T0 })

    assert.isTrue(isOverdue(announced, T0 + 6 * HOUR))
    assert.isTrue(wasAnnounced(announced))
    assert.isFalse(wasAnnounced(subject()))
    assert.isFalse(wasAnnounced(subject({ announcedOfflineAt: T0 - 60 })))
  })

  test('test_returning_device_resolves_gap_with_duration', ({ assert }) => {
    assert.equal(gapSeconds(T0, T0 + 7 * HOUR), 7 * HOUR)
    assert.equal(gapSeconds(T0, T0 - 5), 0)
  })

  test('test_deadman_hours_are_whole_hours_from_one_to_forty_eight', ({ assert }) => {
    assert.isTrue(isDeadmanHours(1))
    assert.isTrue(isDeadmanHours(48))
    for (const value of [0, 49, 1.5, Number.NaN]) assert.isFalse(isDeadmanHours(value))
  })
})

test.group('Device token rotation', () => {
  test('test_a_token_is_due_for_rotation_after_thirty_days', ({ assert }) => {
    assert.isFalse(isRotationDue(T0, T0 + 30 * 24 * HOUR - 1))
    assert.isTrue(isRotationDue(T0, T0 + 30 * 24 * HOUR))
  })

  test('test_a_retried_rotation_never_extends_the_previous_tokens_grace', ({ assert }) => {
    assert.equal(previousTokenValidUntil(T0, null), T0 + 600)
    assert.equal(previousTokenValidUntil(T0 + 300, T0 + 600), T0 + 600)
    assert.equal(previousTokenValidUntil(T0, T0 + 60), T0 + 60)
  })
})

test.group('Bypass event details', () => {
  test('test_codes_numbers_and_booleans_are_accepted', ({ assert }) => {
    const details = {
      targetGroup: 'social.video',
      waitEndedAt: '2026-01-05T09:00:00.000Z',
      waitSeconds: 120,
      announced: true,
    }

    assert.deepEqual(checkBypassDetails(details), { ok: true, value: details })
    assert.deepEqual(checkBypassDetails(undefined), { ok: true, value: {} })
  })

  test('test_urls_titles_and_free_text_never_fit_in_details', ({ assert }) => {
    for (const value of [
      'https://video.example.com/watch',
      'video.example.com/path',
      'A page title with spaces',
      'user@example.com',
      'a'.repeat(65),
    ]) {
      assert.deepEqual(
        checkBypassDetails({ site: value }),
        { ok: false, reason: 'bad_value' },
        value
      )
    }
  })

  test('test_nested_values_bad_keys_and_too_many_members_are_refused', ({ assert }) => {
    assert.deepEqual(checkBypassDetails({ nested: { a: 1 } }), { ok: false, reason: 'bad_value' })
    assert.deepEqual(checkBypassDetails({ list: ['a'] }), { ok: false, reason: 'bad_value' })
    assert.deepEqual(checkBypassDetails({ infinite: Infinity }), { ok: false, reason: 'bad_value' })
    assert.deepEqual(checkBypassDetails({ 'Bad Key': 1 }), { ok: false, reason: 'bad_key' })
    assert.deepEqual(checkBypassDetails(['a']), { ok: false, reason: 'not_an_object' })
    const many = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`k${i}`, i]))
    assert.deepEqual(checkBypassDetails(many), { ok: false, reason: 'too_many' })
  })
})

test.group('Bypass dedupe keys and kinds', () => {
  test('test_client_keys_can_never_collide_with_server_keys', ({ assert }) => {
    const device = '6f1c2d3e-4b5a-4c6d-8e7f-90a1b2c3d4e5'
    const server = serverDedupeKey('heartbeat_missing', device, T0)

    assert.equal(server, `s:heartbeat_missing:${device}:${T0}`)
    assert.equal(clientDedupeKey(device, 'abc-1'), `c:${device}:abc-1`)
    assert.notEqual(clientDedupeKey(device, server.slice(2)), server)
    assert.throws(() => clientDedupeKey(device, 'has space'))
    assert.throws(() => clientDedupeKey(device, ''))
  })

  test('test_a_device_cannot_report_a_server_kind', ({ assert }) => {
    for (const kind of SERVER_BYPASS_KINDS) {
      assert.notInclude(CLIENT_BYPASS_KINDS as readonly string[], kind)
    }
  })
})

test.group('Device fields', () => {
  test('test_device_names_are_short_and_free_of_control_characters', ({ assert }) => {
    assert.isTrue(isDeviceName('Work laptop'))
    assert.isFalse(isDeviceName(''))
    assert.isFalse(isDeviceName('a'.repeat(65)))
    assert.isFalse(isDeviceName('line\nbreak'))
  })

  test('test_a_user_has_room_for_twenty_active_devices', ({ assert }) => {
    assert.isTrue(hasRoomForAnotherDevice(MAX_ACTIVE_DEVICES - 1))
    assert.isFalse(hasRoomForAnotherDevice(MAX_ACTIVE_DEVICES))
  })

  test('test_the_clock_offset_is_server_minus_client_clamped', ({ assert }) => {
    assert.equal(clockOffsetMs(10_000, 4_000), 6_000)
    assert.equal(clockOffsetMs(0, 1e15), -2_147_483_647)
  })
})
