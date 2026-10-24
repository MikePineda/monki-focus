// SPDX-License-Identifier: AGPL-3.0-or-later
import { ENGINE_ERROR_DECISION } from '@monki-focus/engine'
import { describe, expect, it, vi } from 'vitest'
import { createCommandHandlers } from '../../../../src/background/commands/commands'
import { bundledRulesCatalog } from '../../../../src/shared/bundledRulesCatalog'
import { fixedClock } from '../../../../src/shared/clock'
import type { FeedDecision } from '../../../../src/shared/messages'

function answer(restrict: string[]): FeedDecision {
  return { surface: null, decision: { ...ENGINE_ERROR_DECISION }, hide: [], restrict }
}

function makeHandlers(restrict: string[]) {
  const feedDecisionFor = vi.fn(() => Promise.resolve(answer(restrict)))
  const apply = vi.fn(() => Promise.resolve())
  const handlers = createCommandHandlers({
    clock: fixedClock('2026-10-27T12:00:00Z'),
    catalog: bundledRulesCatalog(),
    decisions: { feedDecisionFor },
    shortsRedirect: { apply },
  })
  return { handlers, feedDecisionFor, apply }
}

const sender = { id: 'own' }

describe('decision.get', () => {
  it('answers_the_feed_decision_of_the_asked_url', async () => {
    const { handlers, feedDecisionFor } = makeHandlers([])

    const result = await handlers['decision.get']({ url: 'https://www.reddit.com/' }, sender)

    expect(result).toEqual(answer([]))
    expect(feedDecisionFor).toHaveBeenCalledWith('https://www.reddit.com/')
  })

  it('a_youtube_page_keeps_the_shorts_redirect_in_step', async () => {
    const { handlers, apply } = makeHandlers(['youtube.home', 'youtube.shorts'])

    await handlers['decision.get']({ url: 'https://www.youtube.com/' }, sender)

    expect(apply).toHaveBeenCalledWith(true)
  })

  it('a_youtube_page_without_restricted_shorts_turns_the_redirect_off', async () => {
    const { handlers, apply } = makeHandlers(['youtube.home'])

    await handlers['decision.get']({ url: 'https://m.youtube.com/watch?v=abcdefghijk' }, sender)

    expect(apply).toHaveBeenCalledWith(false)
  })

  it('other_sites_never_touch_the_shorts_redirect', async () => {
    const { handlers, apply } = makeHandlers([])

    await handlers['decision.get']({ url: 'https://www.reddit.com/' }, sender)

    expect(apply).not.toHaveBeenCalled()
  })

  it('a_failed_toggle_never_fails_the_decision', async () => {
    const { handlers, apply } = makeHandlers(['youtube.shorts'])
    apply.mockRejectedValueOnce(new Error('dnr'))

    await expect(
      handlers['decision.get']({ url: 'https://www.youtube.com/' }, sender)
    ).resolves.toEqual(answer(['youtube.shorts']))
  })
})
