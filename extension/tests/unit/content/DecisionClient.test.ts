// SPDX-License-Identifier: AGPL-3.0-or-later
import { ENGINE_ERROR_DECISION } from '@monki-focus/engine'
import { describe, expect, it, vi } from 'vitest'
import { requestFeedDecision } from '../../../src/content/DecisionClient'
import { commandMessage, type FeedDecision } from '../../../src/shared/messages'

const URL_ = 'https://www.reddit.com/'
const ANSWER: FeedDecision = {
  surface: 'reddit.feed',
  decision: { ...ENGINE_ERROR_DECISION },
  hide: ['reddit.feed'],
  restrict: [],
  validUntil: null,
}

describe('requestFeedDecision', () => {
  it('sends_a_typed_decision_command_to_the_service_worker', async () => {
    const send = vi.fn(() => Promise.resolve({ ok: true, data: ANSWER }))

    expect(await requestFeedDecision(send, URL_)).toEqual(ANSWER)
    expect(send).toHaveBeenCalledWith(commandMessage('decision.get', { url: URL_ }))
  })

  it.each([
    undefined,
    { ok: false, error: 'sender.rejected' },
    { ok: true, data: { surface: 1, decision: {}, hide: [], restrict: [] } },
    { ok: true, data: { ...ANSWER, hide: [1] } },
    { ok: true, data: { ...ANSWER, decision: null } },
    { ok: true, data: { ...ANSWER, validUntil: 1767603600 } },
  ])('an_unusable_answer_%j_rejects', async (result) => {
    await expect(requestFeedDecision(() => Promise.resolve(result), URL_)).rejects.toThrow(
      'decision.unavailable'
    )
  })
})
