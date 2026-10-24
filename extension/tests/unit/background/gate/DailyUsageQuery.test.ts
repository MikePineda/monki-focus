// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ActivityEvent } from '@monki-focus/analytics'
import { describe, expect, it } from 'vitest'
import { DailyUsageQuery } from '../../../../src/background/gate/DailyUsageQuery'
import { frictionCandidates } from '../../../../src/background/gate/FrictionCandidates'
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

function query(events: ActivityEvent[], ruleset = budgetedRuleset()) {
  return new DailyUsageQuery({
    catalog: bundledRulesCatalog(),
    rulesets: { load: () => Promise.resolve(ruleset) },
    events: (from, to) =>
      Promise.resolve(events.filter((event) => event.timestamp >= from && event.timestamp < to)),
  })
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

  it('without_a_budgeted_rule_there_is_no_usage', async () => {
    expect(await query([], gatedRuleset()).usageAt(NOW)).toBeNull()
  })
})

describe('frictionCandidates', () => {
  it('finds_the_friction_rules_the_engine_applies_to_a_page', () => {
    const ruleset = gatedRuleset()
    const extra = {
      id: 'reddit-sub-friction',
      target: { kind: 'site' as const, domain: 'reddit.com', path: '/r/examplesub/**' },
      mode: 'friction' as const,
      schedules: [],
      enabled: true,
    }
    const withExtra = { ...ruleset, rules: [...ruleset.rules, extra] }

    const ids = frictionCandidates(
      withExtra,
      'https://www.reddit.com/r/examplesub/',
      '2026-01-05T09:00:00Z',
      bundledRulesCatalog()
    ).map((rule) => rule.id)

    expect(ids).toEqual(['starter-reddit-friction', 'reddit-sub-friction'])
  })
})
