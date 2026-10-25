// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ActivityEvent } from '@monki-focus/analytics'
import type { Ruleset } from '@monki-focus/rules/pure'
import { describe, expect, it } from 'vitest'
import { DailyUsageQuery } from '../../../../src/background/gate/DailyUsageQuery'
import { bundledRulesCatalog } from '../../../../src/shared/bundledRulesCatalog'
import { makeEvent } from '../../../factories/makeEvent'
import { gatedRuleset } from '../../../support/gateHarness'

const NOW = Date.parse('2026-01-05T09:00:00Z')

function budgetedRuleset() {
  const ruleset = gatedRuleset()
  return {
    ...ruleset,
    rules: ruleset.rules.map((rule) =>
      rule.id === 'starter-reddit-friction' ? { ...rule, dailyBudgetMinutes: 30 } : rule
    ),
  }
}

function query(
  events: ActivityEvent[],
  ruleset = budgetedRuleset(),
  diagnose: (code: string) => void = () => undefined
) {
  let failing = false
  const usage = new DailyUsageQuery({
    catalog: bundledRulesCatalog(),
    rulesets: { load: () => Promise.resolve(ruleset) },
    diagnose,
    events: (from, to) =>
      failing
        ? Promise.reject(new Error('idb.unavailable'))
        : Promise.resolve(
            events.filter((event) => event.timestamp >= from && event.timestamp < to)
          ),
  })
  return Object.assign(usage, {
    fail: () => {
      failing = true
    },
  })
}

function redditEvent(timestamp: string, duration: number) {
  return makeEvent({ timestamp, duration, data: { domain: 'reddit.com', path: '/' } })
}

describe('DailyUsageQuery', () => {
  it('todays_time_on_a_budgeted_site_accrues_to_its_rule', async () => {
    const usage = await query([
      makeEvent({
        timestamp: '2026-01-05T08:00:00Z',
        duration: 120,
        data: { domain: 'reddit.com', path: '/r/a/' },
      }),
      makeEvent({
        timestamp: '2026-01-05T08:10:00Z',
        duration: 60,
        data: { domain: 'old.reddit.com', path: '/' },
      }),
      makeEvent({
        timestamp: '2026-01-05T08:20:00Z',
        duration: 600,
        data: { domain: 'youtube.com', path: '/' },
      }),
      makeEvent({
        timestamp: '2026-01-04T23:00:00Z',
        duration: 900,
        data: { domain: 'reddit.com', path: '/' },
      }),
    ]).usageAt(NOW)

    expect(usage).toEqual({
      localDate: '2026-01-05',
      secondsByRule: { 'starter-reddit-friction': 180 },
    })
  })

  it('time_accrues_to_every_budgeted_candidate_the_engine_names_while_scheduled', async () => {
    const base = budgetedRuleset()
    const ruleset: Ruleset = {
      ...base,
      rules: [
        ...base.rules,
        {
          id: 'reddit-sub-budget',
          target: { kind: 'site' as const, domain: 'reddit.com', path: '/r/examplesub/**' },
          mode: 'friction' as const,
          schedules: [],
          enabled: true,
          dailyBudgetMinutes: 10,
        },
        {
          id: 'reddit-evening-budget',
          target: { kind: 'site' as const, domain: 'reddit.com' },
          mode: 'friction' as const,
          schedules: [
            {
              days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
              start: '18:00',
              end: '23:00',
            },
          ],
          enabled: true,
          dailyBudgetMinutes: 20,
        },
      ],
    }

    const usage = await query(
      [
        makeEvent({
          timestamp: '2026-01-05T08:00:00Z',
          duration: 120,
          data: { domain: 'reddit.com', path: '/r/examplesub/' },
        }),
      ],
      ruleset
    ).usageAt(NOW)

    expect(usage?.secondsByRule).toEqual({
      'reddit-sub-budget': 120,
      'starter-reddit-friction': 120,
    })
  })

  it('an_event_that_spans_local_midnight_counts_only_its_part_inside_today', async () => {
    const usage = await query([redditEvent('2026-01-04T23:50:00Z', 1200)]).usageAt(NOW)

    expect(usage?.secondsByRule).toEqual({ 'starter-reddit-friction': 600 })
  })

  it('while_a_time_zone_change_waits_today_counts_in_either_zone', async () => {
    // 22:00 UTC on 4 Jan is already 5 Jan in Pacific/Auckland (+13).
    const ruleset = { ...budgetedRuleset(), pendingTimeZone: 'Pacific/Auckland' }

    const usage = await query([redditEvent('2026-01-04T22:00:00Z', 300)], ruleset).usageAt(NOW)

    expect(usage).toEqual({
      localDate: '2026-01-05',
      secondsByRule: { 'starter-reddit-friction': 300 },
    })
  })

  it('an_unreadable_database_keeps_the_last_good_usage_of_the_day', async () => {
    const codes: string[] = []
    const usage = query([redditEvent('2026-01-05T08:00:00Z', 120)], budgetedRuleset(), (code) =>
      codes.push(code)
    )
    const good = await usage.usageAt(NOW)

    usage.fail()
    expect(await usage.usageAt(NOW + 60_000)).toEqual(good)
    expect(codes).toEqual(['usage.lastGoodKept'])
  })

  it('without_a_good_value_an_unreadable_database_fails_open_with_a_diagnostic', async () => {
    const codes: string[] = []
    const usage = query([], budgetedRuleset(), (code) => codes.push(code))
    usage.fail()

    expect(await usage.usageAt(NOW)).toBeNull()
    expect(codes).toEqual(['usage.unavailable'])
  })

  it('without_a_budgeted_rule_there_is_no_usage', async () => {
    expect(await query([], gatedRuleset()).usageAt(NOW)).toBeNull()
  })
})
