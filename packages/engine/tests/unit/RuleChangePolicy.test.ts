// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import type { Rule, Ruleset } from '@monki-focus/rules'
import { effectiveRuleSet } from '../../src/index.ts'
import { effectiveFromOf, MAX_WINDOW_ROUNDS } from '../../src/EffectiveFromCalculator.ts'
import { epochSecondsOf } from '../../src/Instant.ts'
import { fixtureCatalog } from '../fixtures/FixtureCatalog.ts'
import { makeRule, makeRuleset } from '../factories/RulesetFactory.ts'

const NOW = '2026-10-26T15:00:00Z'
const NEXT_MIDNIGHT = '2026-10-27T00:00:00Z'

function change(old: Ruleset, next: Ruleset, pending: string | null = null) {
  return effectiveRuleSet(old, next, NOW, pending, fixtureCatalog())
}

function rulesChange(before: Rule[], after: Rule[]) {
  return change(makeRuleset({ rules: before }), makeRuleset({ revision: 2, rules: after }))
}

describe('RuleChangePolicy', () => {
  it('raising_a_budget_waits', () => {
    const result = rulesChange(
      [makeRule({ id: 'r', mode: 'friction', dailyBudgetMinutes: 10 })],
      [makeRule({ id: 'r', mode: 'friction', dailyBudgetMinutes: 20 })]
    )
    expect(result.effectiveFrom).toBe(NEXT_MIDNIGHT)
    expect(result.effectiveToday.rules[0]?.dailyBudgetMinutes).toBe(10)
  })

  it('a_changed_note_is_neutral', () => {
    const result = rulesChange([makeRule({ id: 'r' })], [makeRule({ id: 'r', note: 'reminder' })])
    expect(result.effectiveFrom).toBeNull()
  })

  it('an_added_disabled_rule_waits_and_is_left_out_today', () => {
    const result = rulesChange([], [makeRule({ id: 'r', enabled: false })])
    expect(result).toMatchObject({ effectiveFrom: NEXT_MIDNIGHT, effectiveToday: { rules: [] } })
  })

  it('an_added_hide_feed_rule_never_outranks_on_the_access_axis', () => {
    const block = makeRule({ id: 'r-block' })
    const hide = makeRule({
      id: 'r-hide',
      mode: 'hide-feed',
      target: { kind: 'site', domain: 'example.org', path: '/feed' },
    })
    expect(rulesChange([block], [block, hide]).effectiveFrom).toBeNull()
  })

  it('a_friction_rule_with_a_disjoint_schedule_does_not_outrank_a_block', () => {
    const block = makeRule({
      id: 'r-block',
      schedules: [{ days: ['mon'], start: '09:00', end: '10:00' }],
    })
    const gate = makeRule({
      id: 'r-gate',
      mode: 'friction',
      target: { kind: 'site', domain: 'example.org', path: '/a/**' },
      schedules: [{ days: ['tue'], start: '09:00', end: '10:00' }],
    })
    expect(rulesChange([block], [block, gate]).effectiveFrom).toBeNull()
  })

  it('removing_a_disabled_rule_waits', () => {
    const result = rulesChange([makeRule({ id: 'r', mode: 'allow', enabled: false })], [])
    expect(result.effectiveFrom).toBe(NEXT_MIDNIGHT)
    expect(result.effectiveToday.rules).toHaveLength(1)
  })

  it('disabling_a_plain_allow_rule_applies_at_once', () => {
    const result = rulesChange(
      [makeRule({ id: 'r', mode: 'allow' })],
      [makeRule({ id: 'r', mode: 'allow', enabled: false })]
    )
    expect(result.effectiveFrom).toBeNull()
  })

  it('enabling_an_allow_rule_waits', () => {
    const result = rulesChange(
      [makeRule({ id: 'r', mode: 'allow', enabled: false })],
      [makeRule({ id: 'r', mode: 'allow' })]
    )
    expect(result.effectiveFrom).toBe(NEXT_MIDNIGHT)
  })

  it('allow_to_hide_feed_tightens_and_friction_to_allow_waits', () => {
    expect(
      rulesChange(
        [makeRule({ id: 'r', mode: 'allow' })],
        [makeRule({ id: 'r', mode: 'hide-feed' })]
      ).effectiveFrom
    ).toBeNull()
    expect(
      rulesChange([makeRule({ id: 'r', mode: 'friction' })], [makeRule({ id: 'r', mode: 'allow' })])
        .effectiveFrom
    ).toBe(NEXT_MIDNIGHT)
  })

  it('changing_the_schedule_of_an_allow_rule_waits', () => {
    const before = makeRule({
      id: 'r',
      mode: 'allow',
      schedules: [{ days: ['mon'], start: '09:00', end: '10:00' }],
    })
    const after = makeRule({ id: 'r', mode: 'allow', schedules: [] })
    expect(rulesChange([before], [after]).effectiveFrom).toBe(NEXT_MIDNIGHT)
  })

  it('a_waiting_schedule_change_runs_its_old_window_to_the_end', () => {
    const before = makeRule({
      id: 'r',
      schedules: [{ days: ['mon'], start: '23:00', end: '02:00' }],
    })
    const after = makeRule({
      id: 'r',
      schedules: [{ days: ['mon'], start: '23:30', end: '01:00' }],
    })
    expect(rulesChange([before], [after]).effectiveFrom).toBe('2026-10-27T02:00:00Z')
  })

  it('an_equal_week_set_written_differently_is_not_a_change_of_hours', () => {
    const before = makeRule({ id: 'r', schedules: [{ ref: 'workHours' }] })
    const after = makeRule({
      id: 'r',
      schedules: [{ days: ['fri', 'thu', 'wed', 'tue', 'mon'], start: '09:00', end: '17:30' }],
    })
    expect(rulesChange([before], [after]).effectiveFrom).toBeNull()
  })

  it('an_added_category_waits_and_is_left_out_today', () => {
    const assignment = {
      target: { kind: 'site', domain: 'news.example.org' },
      level: 25,
      category: 'news',
    } as const
    const result = change(makeRuleset(), makeRuleset({ revision: 2, categories: [assignment] }))
    expect(result).toMatchObject({
      effectiveFrom: NEXT_MIDNIGHT,
      effectiveToday: { categories: [] },
    })
  })

  it('a_removed_category_is_kept_today', () => {
    const assignment = {
      target: { kind: 'app', package: 'com.example.reader' },
      level: 75,
      category: 'reading',
    } as const
    const result = change(makeRuleset({ categories: [assignment] }), makeRuleset({ revision: 2 }))
    expect(result).toMatchObject({
      effectiveFrom: NEXT_MIDNIGHT,
      effectiveToday: { categories: [assignment] },
    })
  })

  it('a_pending_time_zone_of_the_new_set_is_kept_when_the_zone_does_not_change', () => {
    const old = makeRuleset({ rules: [makeRule({ id: 'r' })] })
    const next = makeRuleset({ revision: 2, pendingTimeZone: 'Europe/London', rules: [] })
    expect(change(old, next).effectiveToday).toMatchObject({
      timeZone: 'UTC',
      pendingTimeZone: 'Europe/London',
    })
  })

  it('a_time_zone_change_runs_every_old_rule_window_to_its_end', () => {
    const night = makeRule({
      id: 'r',
      schedules: [{ days: ['mon'], start: '22:00', end: '03:00' }],
    })
    const old = makeRuleset({
      rules: [
        night,
        makeRule({
          id: 'r-off',
          enabled: false,
          schedules: [{ days: ['tue'], start: '00:00', end: '23:00' }],
        }),
      ],
    })
    const next = makeRuleset({ ...old, revision: 2, timeZone: 'Atlantic/Reykjavik' })
    expect(change(old, next).effectiveFrom).toBe('2026-10-27T03:00:00Z')
  })

  it('a_waiting_work_hours_change_runs_the_old_window_to_its_end', () => {
    const old = makeRuleset({
      workHours: {
        days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        start: '23:00',
        end: '01:00',
      },
    })
    const next = makeRuleset({
      revision: 2,
      workHours: { days: ['mon'], start: '09:00', end: '17:00' },
    })
    expect(change(old, next).effectiveFrom).toBe('2026-10-27T01:00:00Z')
  })

  it('disabling_a_disabled_bedtime_with_other_hours_waits_without_a_window', () => {
    const old = makeRuleset()
    const next = makeRuleset({ revision: 2, bedtime: { ...old.bedtime, start: '23:00' } })
    expect(change(old, next).effectiveFrom).toBe(NEXT_MIDNIGHT)
  })

  it('a_changed_warning_alone_applies_at_once', () => {
    const old = makeRuleset()
    const next = makeRuleset({ revision: 2, bedtime: { ...old.bedtime, warnMinutesBefore: 60 } })
    expect(change(old, next)).toMatchObject({ effectiveFrom: null, effectiveToday: next })
  })
})

describe('EffectiveFromCalculator', () => {
  it('windows_that_cover_the_whole_week_stop_after_a_bounded_number_of_rounds', () => {
    const always = {
      days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const,
      start: '00:00',
      end: '00:00',
    }
    const from = effectiveFromOf(
      epochSecondsOf(NOW),
      ['UTC'],
      [{ ...always, days: [...always.days] }],
      null
    )
    expect(from).toBe(epochSecondsOf(NEXT_MIDNIGHT) + MAX_WINDOW_ROUNDS * 86_400)
  })

  it('never_moves_a_pending_change_earlier', () => {
    const pending = epochSecondsOf('2026-10-28T00:00:00Z')
    expect(effectiveFromOf(epochSecondsOf(NOW), ['UTC'], [], pending)).toBe(pending)
  })
})
