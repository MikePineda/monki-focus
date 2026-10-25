// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { SERVER_BYPASS_KINDS } from '#domain/devices/bypass_event_kinds'
import {
  GUARDIAN_EVENT_DETAIL_RULES,
  GUARDIAN_EVENT_KINDS,
  checkGuardianEventDetails,
} from '#domain/guardians/guardian_event_details'
import {
  GUARDIAN_NOTICE_KINDS,
  guardianNoticeDedupeKey,
  guardianNoticePayload,
} from '#domain/guardians/guardian_notice'

const T0 = new Date('2026-01-05T09:00:00Z')

test.group('Guardian link events', () => {
  test('test_every_guardian_event_kind_is_a_server_kind', ({ assert }) => {
    for (const kind of GUARDIAN_EVENT_KINDS) {
      assert.include(SERVER_BYPASS_KINDS as readonly string[], kind)
    }
  })

  test('test_guardian_event_details_are_enums_and_bounded_integers_only', ({ assert }) => {
    for (const kind of GUARDIAN_EVENT_KINDS) {
      for (const rule of Object.values(GUARDIAN_EVENT_DETAIL_RULES[kind])) {
        assert.include(['enum', 'integer'], rule.type, kind)
      }
    }
    assert.isTrue(
      checkGuardianEventDetails('guardian_revocation_requested', { cooldownHours: 24 }).ok
    )
    assert.isTrue(
      checkGuardianEventDetails('guardian_unlinked', { endedBy: 'ward', reason: 'revoked' }).ok
    )
    assert.isTrue(checkGuardianEventDetails('guardian_linked', {}).ok)
  })

  test('test_guardian_event_details_refuse_free_strings_and_unknown_keys', ({ assert }) => {
    for (const [kind, details] of [
      ['guardian_revocation_requested', { cooldownHours: 169 }],
      ['guardian_revocation_requested', { cooldownHours: '24' }],
      ['guardian_unlinked', { endedBy: 'someone@example.com' }],
      ['guardian_unlinked', { endedBy: 'ward', guardianEmail: 'x' }],
      ['guardian_linked', { guardianName: 'x' }],
      ['guardian_topic_rotated', { topic: 'mf-abc' }],
    ] as const) {
      assert.isFalse(checkGuardianEventDetails(kind, details).ok, JSON.stringify(details))
    }
  })
})

test.group('Guardian notices', () => {
  test('test_notices_carry_codes_and_ids_only', ({ assert }) => {
    assert.deepEqual(GUARDIAN_NOTICE_KINDS, [
      'revocation_requested',
      'revocation_cancelled',
      'pairing_ended',
      'topic_rotated',
    ])
    assert.deepEqual(
      guardianNoticePayload({ kind: 'revocation_requested', linkId: 4, effectiveAt: T0 }),
      {
        type: 'guardian_notice',
        kind: 'revocation_requested',
        linkId: 4,
        effectiveAt: '2026-01-05T09:00:00.000Z',
      }
    )
    assert.deepEqual(guardianNoticePayload({ kind: 'pairing_ended', linkId: 4 }), {
      type: 'guardian_notice',
      kind: 'pairing_ended',
      linkId: 4,
    })
  })

  test('test_a_notice_is_queued_once_per_link_kind_and_instant', ({ assert }) => {
    const key = guardianNoticeDedupeKey(4, 'pairing_ended', T0)

    assert.equal(key, `guardian_link:4:pairing_ended:${T0.getTime()}`)
    assert.notEqual(key, guardianNoticeDedupeKey(5, 'pairing_ended', T0))
    assert.notEqual(key, guardianNoticeDedupeKey(4, 'revocation_requested', T0))
  })
})
