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
const ATTRIBUTES = { hide: 'data-aaaaaaaaaaaa', restrict: 'data-bbbbbbbbbbbb' }
const SHOW: Decision = {
  access: 'allow',
  content: 'show',
  ruleId: null,
  reason: 'no_rule',
  explanationKey: 'decision.no_rule',
  validUntil: '2026-01-06T09:00:00Z',
}

function shown(surface: string | null): FeedDecision {
  return { surface, decision: SHOW, hide: [], restrict: [], validUntil: null }
}

function hidden(surface: string): FeedDecision {
  return {
    surface,
    decision: { ...SHOW, content: 'hide-feed', reason: 'rule_match' },
    hide: [surface],
    restrict: [surface],
    validUntil: null,
  }
}

interface Deferred {
  resolve: (answer: FeedDecision) => void
  reject: (error: Error) => void
}

function makeGuard(site = reddit, href = HOME) {
  const pending: Deferred[] = []
  const requestDecision = vi.fn<(url: string) => Promise<FeedDecision>>(
    () =>
      new Promise<FeedDecision>((resolve, reject) => {
        pending.push({ resolve, reject })
      })
  )
  const placeholder = {
    show: vi.fn<(surface: string | null) => void>(),
    destroy: vi.fn(),
  }
  const location = { href, replace: vi.fn<(url: string) => void>() }
  const attachStylesheet = vi.fn(() => Promise.resolve())
  const onApplied = vi.fn()
  const guard = new FeedGuard({
    window: { document, location } as unknown as Window,
    catalog: bundledRulesCatalog(),
    site,
    attributes: ATTRIBUTES,
    requestDecision,
    attachStylesheet,
    placeholder,
    onApplied,
  })
  return { guard, pending, requestDecision, placeholder, location, attachStylesheet, onApplied }
}

const tokens = () => document.documentElement.getAttribute(ATTRIBUTES.hide)

describe('FeedGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.documentElement.removeAttribute(ATTRIBUTES.hide)
    document.documentElement.removeAttribute(ATTRIBUTES.restrict)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('a_feed_page_is_hidden_before_the_first_decision_arrives', () => {
    const { guard, requestDecision, attachStylesheet } = makeGuard()

    void guard.start()

    expect(tokens()).toBe('reddit.feed')
    expect(requestDecision).toHaveBeenCalledWith(HOME)
    expect(attachStylesheet).toHaveBeenCalledOnce()
    guard.destroy()
  })

  it('a_permalink_is_never_hidden_while_waiting', () => {
    const { guard } = makeGuard(reddit, PERMALINK)

    void guard.evaluate(PERMALINK)

    expect(tokens()).toBeNull()
  })

  it('the_decision_replaces_the_fail_closed_state', async () => {
    const { guard, pending, placeholder, onApplied } = makeGuard()
    const done = guard.evaluate(HOME)

    pending[0]?.resolve(shown('reddit.feed'))
    await done

    expect(tokens()).toBeNull()
    expect(placeholder.show).toHaveBeenLastCalledWith(null)
    expect(onApplied).toHaveBeenCalledOnce()
  })

  it('a_hidden_feed_gets_the_placeholder', async () => {
    const { guard, pending, placeholder } = makeGuard()
    const done = guard.evaluate(HOME)

    pending[0]?.resolve(hidden('reddit.feed'))
    await done

    expect(tokens()).toBe('reddit.feed')
    expect(placeholder.show).toHaveBeenLastCalledWith('reddit.feed')
  })

  it('a_slow_service_worker_keeps_the_feed_hidden_after_the_timeout', async () => {
    const { guard, pending, placeholder } = makeGuard()
    const done = guard.evaluate(HOME)

    await vi.advanceTimersByTimeAsync(DECISION_TIMEOUT_MS)
    expect(tokens()).toBe('reddit.feed')
    expect(placeholder.show).toHaveBeenLastCalledWith('reddit.feed')

    // A late answer for the page still being shown still wins.
    pending[0]?.resolve(shown('reddit.feed'))
    await done
    expect(tokens()).toBeNull()
  })

  it('a_failed_request_keeps_the_feed_hidden', async () => {
    const { guard, pending, placeholder } = makeGuard()
    const done = guard.evaluate(HOME)

    pending[0]?.reject(new Error('no receiver'))
    await done

    expect(tokens()).toBe('reddit.feed')
    expect(placeholder.show).toHaveBeenLastCalledWith('reddit.feed')
  })

  it('an_answer_for_a_page_already_left_is_dropped', async () => {
    const { guard, pending, location } = makeGuard()
    const first = guard.evaluate(HOME)
    location.href = PERMALINK
    const second = guard.evaluate(PERMALINK)

    pending[1]?.resolve(shown('reddit.permalink'))
    await second
    pending[0]?.resolve(hidden('reddit.feed'))
    await first

    expect(tokens()).toBeNull()
  })

  it('a_late_answer_after_a_navigation_the_watcher_missed_asks_again', async () => {
    const { guard, pending, location, requestDecision } = makeGuard()
    const done = guard.evaluate(PERMALINK.replace('abc123', 'old'))
    location.href = HOME

    pending[0]?.resolve(shown('reddit.permalink'))
    await done

    expect(requestDecision).toHaveBeenLastCalledWith(HOME)
    expect(tokens()).toBe('reddit.feed')
  })

  it('the_same_url_again_keeps_what_is_shown_until_the_answer', async () => {
    const { guard, pending } = makeGuard()
    const first = guard.evaluate(HOME)
    pending[0]?.resolve(shown('reddit.feed'))
    await first

    const again = guard.evaluate(HOME)
    expect(tokens()).toBeNull()
    pending[1]?.resolve(hidden('reddit.feed'))
    await again

    expect(tokens()).toBe('reddit.feed')
  })

  it('an_engine_error_answer_keeps_every_feed_hidden', async () => {
    const { guard, pending } = makeGuard(reddit, PERMALINK)
    const done = guard.evaluate(PERMALINK)

    pending[0]?.resolve({
      surface: 'reddit.permalink',
      decision: { ...ENGINE_ERROR_DECISION },
      hide: ['reddit.feed', 'reddit.user_feed'],
      restrict: ['reddit.feed', 'reddit.user_feed'],
      validUntil: null,
    })
    await done

    expect(tokens()).toBe('reddit.feed reddit.user_feed')
  })

  it('restricted_shorts_after_an_spa_navigation_are_replaced_by_the_watch_page', async () => {
    const shortsUrl = 'https://www.youtube.com/shorts/abcdefghijk'
    const { guard, pending, location } = makeGuard(youtube, shortsUrl)
    const done = guard.evaluate(shortsUrl)

    pending[0]?.resolve({
      surface: 'youtube.shorts',
      decision: { ...SHOW, access: 'block', reason: 'rule_match' },
      hide: [],
      restrict: ['youtube.shorts'],
      validUntil: null,
    })
    await done

    expect(location.replace).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abcdefghijk')
  })

  it('destroy_clears_the_tokens_the_style_and_the_placeholder', async () => {
    const { guard, placeholder } = makeGuard()
    void guard.start()
    expect(tokens()).toBe('reddit.feed')

    guard.destroy()
    await vi.advanceTimersByTimeAsync(0)

    expect(tokens()).toBeNull()
    expect(placeholder.destroy).toHaveBeenCalledOnce()
    expect(
      [...document.querySelectorAll('style')].some((s) => s.textContent?.includes(ATTRIBUTES.hide))
    ).toBe(false)
  })
})
