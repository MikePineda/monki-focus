// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import i18nManager from '@adonisjs/i18n/services/main'
import { ntfyMessage, type NtfyMessageContext } from '#domain/notify/ntfy_message'
import {
  nextAttemptAfterFailure,
  OUTBOX_ERROR_MAX_LENGTH,
  outboxErrorSummary,
} from '#domain/notify/outbox_backoff'
import type { UnlockRequestPayload } from '#domain/notify/notification_payload'

const APP_URL = 'https://focus.example.org'
const UUID = '6f1c2d3e-4b5a-4c6d-8e7f-90a1b2c3d4e5'
const APPROVE = 'A'.repeat(43)
const DENY = 'B'.repeat(43)
const request: UnlockRequestPayload = {
  type: 'unlock_request',
  linkId: 1,
  requestUuid: UUID,
  minutes: 15,
}

async function context(
  overrides: Partial<NtfyMessageContext> = {},
  locale = 'en'
): Promise<NtfyMessageContext> {
  await i18nManager.loadTranslations()
  const i18n = i18nManager.locale(locale)
  return {
    topic: 'mf-aaaaaaaaaaaaaaaaaaaaaaaaaa',
    appUrl: APP_URL,
    translate: (key, params) => i18n.t(key, params),
    allowActions: true,
    actionTokens: { approve: APPROVE, deny: DENY },
    formatInstant: (iso) => iso,
    ...overrides,
  }
}

test.group('ntfy message', () => {
  test('test_message_has_at_most_three_actions', async ({ assert }) => {
    const message = ntfyMessage(request, await context())

    assert.lengthOf(message.actions, 3)
    assert.deepEqual(
      message.actions.map((action) => action.action),
      ['http', 'http', 'view']
    )
    assert.equal(message.priority, 4)
  })

  test('test_actions_are_absolute_post_urls', async ({ assert }) => {
    const [approve, deny, view] = ntfyMessage(request, await context()).actions

    assert.deepInclude(approve, {
      method: 'POST',
      url: `${APP_URL}/api/v1/actions/${APPROVE}`,
      clear: true,
    })
    assert.deepInclude(deny, { method: 'POST', url: `${APP_URL}/api/v1/actions/${DENY}` })
    assert.equal(view.url, `${APP_URL}/guardian/requests/${UUID}`)
  })

  test('test_strict_mode_sends_only_the_view_action', async ({ assert }) => {
    const strict = ntfyMessage(request, await context({ allowActions: false }))
    const unsealed = ntfyMessage(request, await context({ actionTokens: null }))

    for (const message of [strict, unsealed]) {
      assert.deepEqual(
        message.actions.map((action) => action.action),
        ['view']
      )
      assert.notInclude(JSON.stringify(message), APPROVE)
    }
  })

  test('test_message_localized_in_guardian_locale', async ({ assert }) => {
    const english = ntfyMessage(request, await context())
    const spanish = ntfyMessage(request, await context({}, 'es'))

    assert.equal(english.title, 'Unlock request')
    assert.equal(english.actions[0].label, 'Approve 15 min')
    assert.equal(spanish.title, 'Solicitud de desbloqueo')
    assert.equal(spanish.actions[0].label, 'Aprobar 15 min')
    assert.include(spanish.message, '15')
  })

  test('test_already_queued_guardian_notices_are_rendered', async ({ assert }) => {
    const ctx = await context()
    for (const kind of [
      'revocation_requested',
      'revocation_cancelled',
      'pairing_ended',
      'topic_rotated',
    ] as const) {
      const message = ntfyMessage(
        { type: 'guardian_notice', kind, linkId: 1, effectiveAt: '2026-01-06T09:00:00.000Z' },
        ctx
      )
      assert.notInclude(message.title, 'notifications.')
      assert.notInclude(message.message, 'notifications.')
      assert.lengthOf(message.actions, 0)
    }
  })

  test('test_decision_confirmation_and_bypass_alert_are_rendered', async ({ assert }) => {
    const ctx = await context()
    const approved = ntfyMessage(
      { type: 'unlock_decided', linkId: 1, requestUuid: UUID, decision: 'approved', minutes: 10 },
      ctx
    )
    const alert = ntfyMessage({ type: 'bypass_alert', linkId: 1 }, ctx)

    assert.equal(approved.title, 'Unlock approved')
    assert.include(approved.message, '10')
    assert.equal(alert.title, 'Protection event')
  })
})

test.group('outbox backoff', () => {
  test('test_retries_wait_10_s_30_s_then_2_min_and_then_give_up', ({ assert }) => {
    const now = new Date('2026-01-05T09:00:00Z')

    assert.equal(nextAttemptAfterFailure(1, now)?.toISOString(), '2026-01-05T09:00:10.000Z')
    assert.equal(nextAttemptAfterFailure(2, now)?.toISOString(), '2026-01-05T09:00:30.000Z')
    assert.equal(nextAttemptAfterFailure(3, now)?.toISOString(), '2026-01-05T09:02:00.000Z')
    assert.isNull(nextAttemptAfterFailure(4, now))
  })

  test('test_last_error_is_one_line_of_at_most_500_characters', ({ assert }) => {
    assert.equal(outboxErrorSummary('ntfy\nanswered  503'), 'ntfy answered 503')
    assert.lengthOf(outboxErrorSummary('x'.repeat(900)), OUTBOX_ERROR_MAX_LENGTH)
    assert.equal(outboxErrorSummary('  '), 'unknown')
  })
})
