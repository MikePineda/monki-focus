// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import type { Observation, Ruleset } from '@monki-focus/rules'
import { budgetedRulesFor, frictionCandidates } from '../../src/index.ts'
import { fixtureCatalog } from '../fixtures/FixtureCatalog.ts'
import { makeRule, makeRuleset } from '../factories/RulesetFactory.ts'

const NOW = '2026-10-26T10:00:00Z'
const page: Observation = { kind: 'site', urlText: 'https://news.example.org/today' }
const ruleset = makeRuleset({
  rules: [
    makeRule({
      id: 'r-news',
      mode: 'friction',
      target: { kind: 'site', domain: 'news.example.org' },
      dailyBudgetMinutes: 10,
    }),
    makeRule({
      id: 'r-other',
      mode: 'allow',
      target: { kind: 'site', domain: 'video.example.net' },
      dailyBudgetMinutes: 5,
    }),
    makeRule({ id: 'r-off', mode: 'allow', dailyBudgetMinutes: 5, enabled: false }),
  ],
})

describe('adapter candidate helpers (SEMANTICS.md §5.7)', () => {
  it('valid_inputs_name_the_matching_candidates', () => {
    expect(frictionCandidates(ruleset, page, NOW, fixtureCatalog())).toEqual(['r-news'])
    expect(budgetedRulesFor(ruleset, page, NOW, fixtureCatalog())).toEqual(['r-news'])
  })

  it('an_instant_without_offset_gives_no_friction_candidates', () => {
    expect(frictionCandidates(ruleset, page, '2026-10-26T10:00:00', fixtureCatalog())).toEqual([])
  })

  it('invalid_inputs_accrue_to_every_enabled_budget', () => {
    const garbage = { kind: 'site', urlText: 42 } as unknown as Observation
    expect(budgetedRulesFor(ruleset, garbage, NOW, fixtureCatalog())).toEqual(['r-news', 'r-other'])
    const lost = { ...ruleset, timeZone: 'Mars/Olympus' }
    expect(budgetedRulesFor(lost, page, NOW, fixtureCatalog())).toEqual(['r-news', 'r-other'])
  })

  it('a_rule_set_that_cannot_be_read_accrues_nothing', () => {
    const broken = { timeZone: 'UTC' } as unknown as Ruleset
    expect(budgetedRulesFor(broken, page, NOW, fixtureCatalog())).toEqual([])
    expect(frictionCandidates(broken, page, NOW, fixtureCatalog())).toEqual([])
  })
})
