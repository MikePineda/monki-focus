// SPDX-License-Identifier: AGPL-3.0-or-later
import { ENGINE_ERROR_DECISION } from '@monki-focus/engine'
import type { Ruleset } from '@monki-focus/rules/pure'
import { starterPreset } from '@monki-focus/rules/pure'
import { describe, expect, it } from 'vitest'
import {
  DecisionService,
  type DecisionServiceOptions,
} from '../../../../src/background/decisions/DecisionService'
import { bundledRulesCatalog } from '../../../../src/shared/bundledRulesCatalog'
import { fixedClock, type Clock } from '../../../../src/shared/clock'

// A Tuesday at noon UTC: outside the starter bedtime and inside work hours.
const NOON = fixedClock('2026-10-27T12:00:00Z')

function starter(): Ruleset {
  return structuredClone(starterPreset)
}

function makeService(overrides: Partial<DecisionServiceOptions> = {}) {
  return new DecisionService({
    catalog: bundledRulesCatalog(),
    rulesets: { load: () => Promise.resolve(starter()) },
    clock: NOON,
    ...overrides,
  })
}

describe('DecisionService with the starter preset', () => {
  it.each([
    ['https://www.reddit.com/', 'reddit.feed'],
    ['https://old.reddit.com/r/all/', 'reddit.feed'],
    ['https://x.com/home', 'x.home'],
    ['https://twitter.com/home', 'x.home'],
    ['https://x.com/explore/tabs/trending', 'x.explore'],
    ['https://www.youtube.com/', 'youtube.home'],
    ['https://www.instagram.com/reels/', 'instagram.reels'],
    ['https://www.instagram.com/explore/', 'instagram.explore'],
  ])('starter_preset_hides_the_feed_of_%s', async (url, surface) => {
    const answer = await makeService().feedDecisionFor(url)

    expect(answer.surface).toBe(surface)
    expect(answer.decision.content).toBe('hide-feed')
    expect(answer.hide).toEqual([surface])
  })

  it.each([
    ['https://www.reddit.com/r/examplesub/comments/abc123/a_synthetic_post/', 'reddit.permalink'],
    ['https://www.reddit.com/search/?q=gardening', 'reddit.search'],
    ['https://x.com/someone/status/1234567890', 'x.status'],
    ['https://www.youtube.com/watch?v=abcdefghijk', 'youtube.watch'],
    ['https://www.youtube.com/results?search_query=bread', 'youtube.search'],
    ['https://www.instagram.com/direct/inbox/', 'instagram.direct'],
    ['https://www.instagram.com/p/AbCdEf/', 'instagram.post'],
  ])('starter_preset_never_hides_the_useful_page_%s', async (url, surface) => {
    const answer = await makeService().feedDecisionFor(url)

    expect(answer.surface).toBe(surface)
    expect(answer.decision.content).toBe('show')
    expect(answer.hide).toEqual([])
  })

  it('starter_preset_keeps_reddit_behind_the_intention_gate', async () => {
    const answer = await makeService().feedDecisionFor('https://www.reddit.com/')

    expect(answer.decision.access).toBe('gate')
  })

  it('starter_preset_blocks_youtube_shorts', async () => {
    const decision = await makeService().decide('https://www.youtube.com/shorts/abcdefghijk')

    expect(decision).toMatchObject({ access: 'block', reason: 'rule_match' })
  })

  it('youtube_pages_restrict_shorts_entry_points_everywhere', async () => {
    const answer = await makeService().feedDecisionFor(
      'https://www.youtube.com/results?search_query=bread'
    )

    expect(answer.restrict).toContain('youtube.shorts')
    expect(answer.restrict).not.toContain('youtube.subscriptions')
  })

  it('instagram_direct_restricts_reels_and_explore_but_not_home', async () => {
    const answer = await makeService().feedDecisionFor('https://www.instagram.com/direct/inbox/')

    expect(answer.restrict).toEqual(['instagram.explore', 'instagram.reels'])
  })

  it('a_site_without_a_profile_hides_nothing', async () => {
    const answer = await makeService().feedDecisionFor('https://news.example/')

    expect(answer).toMatchObject({ surface: null, hide: [], restrict: [] })
    expect(answer.decision.access).toBe('allow')
  })

  it('an_unknown_path_never_hides_content', async () => {
    const answer = await makeService().feedDecisionFor('https://www.reddit.com/r/a%2Fb/')

    expect(answer.surface).toBeNull()
    expect(answer.hide).toEqual([])
  })

  it('an_allow_rule_shows_the_feed_again', async () => {
    const ruleset = starter()
    ruleset.rules = ruleset.rules.filter((rule) => rule.id !== 'starter-reddit-feed-hide')
    const service = makeService({ rulesets: { load: () => Promise.resolve(ruleset) } })

    const answer = await service.feedDecisionFor('https://www.reddit.com/')

    expect(answer.decision.content).toBe('show')
    expect(answer.hide).toEqual([])
  })

  it('restricts_answers_whether_the_rule_set_blocks_or_hides_a_surface', async () => {
    const service = makeService()

    expect(await service.restricts('youtube.shorts')).toBe(true)
    expect(await service.restricts('youtube.home')).toBe(true)
    expect(await service.restricts('youtube.subscriptions')).toBe(false)
  })

  it('decides_with_now_from_the_injected_clock', async () => {
    // 23:00 UTC is inside the starter bedtime (22:30-07:00 in the pinned zone).
    const service = makeService({ clock: fixedClock('2026-10-27T23:00:00Z') })

    const permalink = 'https://www.reddit.com/r/examplesub/comments/abc123/a_synthetic_post/'

    expect(await makeService().decide(permalink)).toMatchObject({ access: 'gate' })
    expect(await service.decide(permalink)).toMatchObject({
      access: 'block',
      reason: 'schedule_bedtime',
    })
  })
})

describe('DecisionService fails closed', () => {
  const ENGINE_ERROR = { ...ENGINE_ERROR_DECISION }

  it('a_rule_set_that_cannot_be_read_blocks_and_hides_the_feed', async () => {
    const service = makeService({ rulesets: { load: () => Promise.reject(new Error('io')) } })

    expect(await service.decide('https://www.reddit.com/')).toEqual(ENGINE_ERROR)
  })

  it('a_throwing_clock_blocks_and_hides_the_feed', async () => {
    const broken: Clock = {
      now: () => {
        throw new Error('clock')
      },
      monotonic: () => 0,
    }

    expect(await makeService({ clock: broken }).decide('https://www.reddit.com/')).toEqual(
      ENGINE_ERROR
    )
  })

  it('a_clock_before_the_epoch_blocks_and_hides_the_feed', async () => {
    const service = makeService({ clock: { now: () => -1, monotonic: () => 0 } })

    expect(await service.decide('https://www.reddit.com/')).toEqual(ENGINE_ERROR)
  })

  it('an_invalid_stored_rule_set_fails_closed_in_the_engine', async () => {
    const service = makeService({
      rulesets: { load: () => Promise.resolve({ garbage: true } as unknown as Ruleset) },
    })

    expect(await service.decide('https://www.reddit.com/')).toEqual(ENGINE_ERROR)
  })

  it('a_failing_state_source_blocks_and_hides_the_feed', async () => {
    const service = makeService({ states: () => Promise.reject(new Error('db')) })

    expect(await service.decide('https://www.reddit.com/')).toEqual(ENGINE_ERROR)
  })

  it('an_engine_error_hides_every_feed_of_the_site_even_on_a_permalink', async () => {
    const service = makeService({ rulesets: { load: () => Promise.reject(new Error('io')) } })

    const answer = await service.feedDecisionFor(
      'https://www.reddit.com/r/examplesub/comments/abc123/a_synthetic_post/'
    )

    expect(answer.decision.reason).toBe('engine_error')
    expect(answer.hide).toEqual(['reddit.feed', 'reddit.user_feed'])
    expect(answer.restrict).toEqual(['reddit.feed', 'reddit.user_feed'])
  })

  it('an_engine_error_turns_every_surface_restricted', async () => {
    const service = makeService({ rulesets: { load: () => Promise.reject(new Error('io')) } })

    expect(await service.restricts('youtube.subscriptions')).toBe(true)
  })

  it('a_surface_the_profiles_cannot_reach_counts_as_restricted', async () => {
    expect(await makeService().restricts('nowhere.feed')).toBe(true)
  })
})
