// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import type { Observation, Rule } from '@monki-focus/rules'
import { decide } from '../../src/index.ts'
import { fixtureCatalog } from '../fixtures/FixtureCatalog.ts'
import { makeEscalation, makeRule, makeRuleset, makeState } from '../factories/RulesetFactory.ts'

const MONDAY_MORNING = '2026-10-26T10:00:00Z'
const MONDAY_NIGHT = '2026-10-26T23:00:00Z'
const site = (urlText: string): Observation => ({ kind: 'site', urlText })
const friction = (id: string, domain = 'news.example.org'): Rule =>
  makeRule({ id, mode: 'friction', target: { kind: 'site', domain } })
const bedtimeOn = {
  enabled: true,
  days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const,
  start: '22:30',
  end: '07:00',
  warnMinutesBefore: 30,
}

describe('DecisionEngine', () => {
  it('a_user_category_beats_a_default_one_at_equal_specificity', () => {
    const ruleset = makeRuleset({
      bedtime: { ...bedtimeOn, days: [...bedtimeOn.days] },
      categories: [
        { target: { kind: 'site', domain: 'reddit.com' }, level: 75, category: 'reading' },
      ],
    })
    const decision = decide(
      ruleset,
      site('https://www.reddit.com/settings'),
      makeState(),
      MONDAY_NIGHT,
      fixtureCatalog()
    )
    expect(decision).toMatchObject({ access: 'allow', reason: 'no_rule' })
  })

  it('on_a_full_tie_the_lower_level_wins_and_bedtime_blocks', () => {
    const ruleset = makeRuleset({
      bedtime: { ...bedtimeOn, days: [...bedtimeOn.days] },
      categories: [
        { target: { kind: 'site', domain: 'news.example.org' }, level: 75, category: 'reading' },
        { target: { kind: 'site', domain: 'www.news.example.org' }, level: 25, category: 'news' },
      ],
    })
    const decision = decide(
      ruleset,
      site('news.example.org/today'),
      makeState(),
      MONDAY_NIGHT,
      fixtureCatalog()
    )
    expect(decision).toMatchObject({ access: 'block', reason: 'schedule_bedtime' })
  })

  it('an_app_observation_takes_its_default_category_at_bedtime', () => {
    const ruleset = makeRuleset({ bedtime: { ...bedtimeOn, days: [...bedtimeOn.days] } })
    const app: Observation = { kind: 'app', package: 'com.reddit.frontpage', surface: null }
    expect(decide(ruleset, app, makeState(), MONDAY_NIGHT, fixtureCatalog())).toMatchObject({
      access: 'block',
      reason: 'schedule_bedtime',
    })
    const editor: Observation = { kind: 'app', package: 'com.example.editor', surface: null }
    expect(decide(ruleset, editor, makeState(), MONDAY_NIGHT, fixtureCatalog())).toMatchObject({
      access: 'allow',
      reason: 'no_rule',
    })
  })

  it('an_unprofiled_bare_domain_without_assignments_is_neutral_at_bedtime', () => {
    const ruleset = makeRuleset({ bedtime: { ...bedtimeOn, days: [...bedtimeOn.days] } })
    expect(
      decide(ruleset, site('news.example.org'), makeState(), MONDAY_NIGHT, fixtureCatalog())
    ).toMatchObject({
      access: 'allow',
      reason: 'no_rule',
    })
  })

  it('usage_without_an_entry_for_the_rule_spends_nothing', () => {
    const ruleset = makeRuleset({
      rules: [
        makeRule({
          id: 'r-news',
          mode: 'allow',
          dailyBudgetMinutes: 10,
          target: { kind: 'site', domain: 'news.example.org' },
        }),
      ],
    })
    const state = makeState({ usage: { localDate: '2026-10-26', secondsByRule: {} } })
    expect(
      decide(ruleset, site('news.example.org/today'), state, MONDAY_MORNING, fixtureCatalog())
    ).toMatchObject({
      access: 'allow',
      reason: 'rule_match',
      ruleId: 'r-news',
    })
  })

  it('a_surface_hide_feed_rule_matches_no_bare_domain_of_an_unprofiled_host', () => {
    const ruleset = makeRuleset({
      rules: [
        makeRule({
          id: 'r-feed',
          mode: 'hide-feed',
          target: { kind: 'surface', surface: 'reddit.feed' },
        }),
      ],
    })
    expect(
      decide(ruleset, site('news.example.org'), makeState(), MONDAY_MORNING, fixtureCatalog())
    ).toMatchObject({
      access: 'allow',
      reason: 'no_rule',
      ruleId: null,
    })
  })

  it('a_hide_feed_rule_on_a_permalink_surface_does_not_gate_a_bare_domain', () => {
    const ruleset = makeRuleset({
      rules: [
        makeRule({
          id: 'r-watch',
          mode: 'hide-feed',
          target: { kind: 'surface', surface: 'youtube.watch' },
        }),
      ],
    })
    expect(
      decide(ruleset, site('youtube.com'), makeState(), MONDAY_MORNING, fixtureCatalog())
    ).toMatchObject({
      access: 'allow',
      reason: 'no_rule',
    })
  })

  it('a_gate_in_progress_is_returned_as_stored', () => {
    const gate = {
      level: 1,
      pauseSeconds: 15,
      frictionType: 'breath',
      requiresTypedIntention: false,
      requiresGuardianKey: false,
    } as const
    const ruleset = makeRuleset({ rules: [friction('r-news')] })
    const state = makeState({
      escalation: [
        makeEscalation('r-news', {
          phase: 'pausing',
          attemptCount: 2,
          lastFrictionType: 'breath',
          gate,
          pauseEndsAt: '2026-10-26T10:00:10Z',
        }),
      ],
    })
    expect(
      decide(ruleset, site('news.example.org/today'), state, MONDAY_MORNING, fixtureCatalog()).gate
    ).toEqual(gate)
  })

  it('a_pausing_state_without_a_stored_gate_gets_the_visit_gate', () => {
    const ruleset = makeRuleset({ rules: [friction('r-news')] })
    const state = makeState({ escalation: [makeEscalation('r-news', { phase: 'pausing' })] })
    expect(
      decide(ruleset, site('news.example.org/today'), state, MONDAY_MORNING, fixtureCatalog()).gate
    ).toMatchObject({
      level: 0,
      frictionType: 'countdown',
    })
  })

  it('a_waiting_override_shows_the_current_gate_without_a_new_attempt', () => {
    const ruleset = makeRuleset({ rules: [friction('r-news')] })
    const state = makeState({
      escalation: [
        makeEscalation('r-news', {
          phase: 'override_waiting',
          attemptCount: 0,
          overrideReadyAt: '2026-10-26T10:01:00Z',
        }),
      ],
    })
    expect(
      decide(ruleset, site('news.example.org/today'), state, MONDAY_MORNING, fixtureCatalog()).gate
    ).toEqual({
      level: 0,
      pauseSeconds: 5,
      frictionType: 'countdown',
      requiresTypedIntention: false,
      requiresGuardianKey: false,
    })
  })

  it('the_friction_type_of_tied_groups_comes_from_the_smallest_rule_id', () => {
    const at = '2026-10-26T09:50:00Z'
    const ruleset = makeRuleset({
      rules: [
        makeRule({
          id: 'r-today',
          mode: 'friction',
          target: { kind: 'site', domain: 'news.example.org', path: '/today/**' },
        }),
        friction('r-b'),
        friction('r-a'),
      ],
    })
    const state = makeState({
      escalation: [
        makeEscalation('r-b', { attemptCount: 1, lastActivityAt: at, lastFrictionType: 'reflect' }),
        makeEscalation('r-a', { attemptCount: 1, lastActivityAt: at, lastFrictionType: 'breath' }),
      ],
    })
    const decision = decide(
      ruleset,
      site('news.example.org/today'),
      state,
      MONDAY_MORNING,
      fixtureCatalog()
    )
    expect(decision).toMatchObject({
      ruleId: 'r-today',
      gate: { level: 1, frictionType: 'reflect' },
    })
  })
})
