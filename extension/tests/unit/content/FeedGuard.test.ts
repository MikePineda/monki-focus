// SPDX-License-Identifier: AGPL-3.0-or-later
import { ENGINE_ERROR_DECISION } from '@monki-focus/engine'
import type { Decision } from '@monki-focus/rules/pure'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DECISION_TIMEOUT_MS, FeedGuard } from '../../../src/content/FeedGuard'
import { bundledRulesCatalog } from '../../../src/shared/bundledRulesCatalog'
import type { FeedDecision } from '../../../src/shared/messages'
import { reddit } from '../../../src/sites/reddit'
import { youtube } from '../../../src/sites/youtube'

const HOME = 'https://www.reddit.com/'
const PERMALINK = 'https://www.reddit.com/r/examplesub/comments/abc123/a_synthetic_post/'
const SHOW: Decision = {
  access: 'allow',
  content: 'show',
  ruleId: null,
  reason: 'no_rule',
  explanationKey: 'decision.no_rule',
}

function shown(surface: string | null): FeedDecision {
  return { surface, decision: SHOW, hide: [], restrict: [] }
}

function hidden(surface: string): FeedDecision {
  return {
    surface,
    decision: { ...SHOW, content: 'hide-feed', reason: 'rule_match' },
    hide: [surface],
    restrict: [surface],
  }
}

interface Deferred {
  resolve: (answer: FeedDecision) => void
  reject: (error: Error) => void
}

function makeGuard(
  site = reddit,
  location: { href: string; replace?: (url: string) => void } = { href: HOME }
) {
  const pending: Deferred[] = []
  const requestDecision = vi.fn(
    () =>
      new Promise<FeedDecision>((resolve, reject) => {
        pending.push({ resolve, reject })
      })
  )
  const placeholder = { show: vi.fn<(surface: string | null) => void>() }
  const fakeWindow = {
    document,
    location: { replace: vi.fn(), ...location },
  } as unknown as Window
  const guard = new FeedGuard({
    window: fakeWindow,
    catalog: bundledRulesCatalog(),
    site,
    requestDecision,
    placeholder,
  })
  return { guard, pending, requestDecision, placeholder, location: fakeWindow.location }
}

const tokens = () => document.documentElement.getAttribute('data-mf-hide')

describe('FeedGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.documentElement.removeAttribute('data-mf-hide')
    document.documentElement.removeAttribute('data-mf-restrict')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('a_feed_page_is_hidden_before_the_first_decision_arrives', () => {
    const { guard, requestDecision } = makeGuard()

    void guard.start()

    expect(tokens()).toBe('reddit.feed')
    expect(requestDecision).toHaveBeenCalledWith(HOME)
  })

  it('a_permalink_is_never_hidden_while_waiting', () => {
    const { guard } = makeGuard()

    void guard.evaluate(PERMALINK)

    expect(tokens()).toBeNull()
  })

  it('the_decision_replaces_the_fail_closed_state', async () => {
    const { guard, pending, placeholder } = makeGuard()
    const done = guard.start()

    pending[0]?.resolve(shown('reddit.feed'))
    await done

    expect(tokens()).toBeNull()
    expect(placeholder.show).toHaveBeenLastCalledWith(null)
  })

  it('a_hidden_feed_gets_the_placeholder', async () => {
    const { guard, pending, placeholder } = makeGuard()
    const done = guard.start()

    pending[0]?.resolve(hidden('reddit.feed'))
    await done

    expect(tokens()).toBe('reddit.feed')
    expect(placeholder.show).toHaveBeenLastCalledWith('reddit.feed')
  })

  it('a_slow_service_worker_keeps_the_feed_hidden_after_the_timeout', async () => {
    const { guard, pending, placeholder } = makeGuard()
    const done = guard.start()

    await vi.advanceTimersByTimeAsync(DECISION_TIMEOUT_MS)
    expect(tokens()).toBe('reddit.feed')
    expect(placeholder.show).toHaveBeenLastCalledWith('reddit.feed')

    // A late answer still wins.
    pending[0]?.resolve(shown('reddit.feed'))
    await done
    expect(tokens()).toBeNull()
  })

  it('a_failed_request_keeps_the_feed_hidden', async () => {
    const { guard, pending, placeholder } = makeGuard()
    const done = guard.start()

    pending[0]?.reject(new Error('no receiver'))
    await done

    expect(tokens()).toBe('reddit.feed')
    expect(placeholder.show).toHaveBeenLastCalledWith('reddit.feed')
  })

  it('an_answer_for_a_page_already_left_is_dropped', async () => {
    const { guard, pending } = makeGuard()
    const first = guard.evaluate(HOME)
    const second = guard.evaluate(PERMALINK)

    pending[1]?.resolve(shown('reddit.permalink'))
    await second
    pending[0]?.resolve(hidden('reddit.feed'))
    await first

    expect(tokens()).toBeNull()
  })

  it('an_engine_error_answer_keeps_every_feed_hidden', async () => {
    const { guard, pending } = makeGuard()
    const done = guard.evaluate(PERMALINK)

    pending[0]?.resolve({
      surface: 'reddit.permalink',
      decision: { ...ENGINE_ERROR_DECISION },
      hide: ['reddit.feed', 'reddit.user_feed'],
      restrict: ['reddit.feed', 'reddit.user_feed'],
    })
    await done

    expect(tokens()).toBe('reddit.feed reddit.user_feed')
  })

  it('restricted_shorts_after_an_spa_navigation_are_replaced_by_the_watch_page', async () => {
    const shortsUrl = 'https://www.youtube.com/shorts/abcdefghijk'
    const { guard, pending, location } = makeGuard(youtube, { href: shortsUrl })
    const done = guard.evaluate(shortsUrl)

    pending[0]?.resolve({
      surface: 'youtube.shorts',
      decision: { ...SHOW, access: 'block', reason: 'rule_match' },
      hide: [],
      restrict: ['youtube.shorts'],
    })
    await done

    expect(location.replace).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abcdefghijk')
  })
})
