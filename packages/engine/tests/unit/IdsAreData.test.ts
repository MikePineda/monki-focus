// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import type { Observation, Rule } from '@monki-focus/rules'
import { createRulesCatalog, decide } from '../../src/index.ts'
import { fixtureCatalog } from '../fixtures/FixtureCatalog.ts'
import { makeEscalation, makeRule, makeRuleset, makeState } from '../factories/RulesetFactory.ts'

/** Valid rule ids that name members of Object.prototype (SEMANTICS.md §14). */
const MEMBER_IDS = [
  'constructor',
  'toString',
  'hasOwnProperty',
  'valueOf',
  'isPrototypeOf',
  'proto__',
]
const NOW = '2026-10-26T10:00:00Z'
const page: Observation = { kind: 'site', urlText: 'https://news.example.org/today' }
const budgeted = (id: string): Rule =>
  makeRule({
    id,
    mode: 'allow',
    dailyBudgetMinutes: 10,
    target: { kind: 'site', domain: 'news.example.org' },
  })

describe('ids are data', () => {
  it.each(MEMBER_IDS)('a_rule_named_%s_without_usage_is_not_exhausted', (id) => {
    const state = makeState({ usage: { localDate: '2026-10-26', secondsByRule: {} } })
    expect(
      decide(makeRuleset({ rules: [budgeted(id)] }), page, state, NOW, fixtureCatalog())
    ).toMatchObject({
      access: 'allow',
      reason: 'rule_match',
      ruleId: id,
    })
  })

  it.each(MEMBER_IDS)('a_rule_named_%s_with_spent_usage_is_exhausted', (id) => {
    const state = makeState({ usage: { localDate: '2026-10-26', secondsByRule: { [id]: 600 } } })
    expect(
      decide(makeRuleset({ rules: [budgeted(id)] }), page, state, NOW, fixtureCatalog())
    ).toMatchObject({
      access: 'block',
      reason: 'budget_exhausted',
      ruleId: id,
    })
  })

  it('a_usage_entry_without_seconds_counts_as_none', () => {
    const state = makeState({ usage: { localDate: '2026-10-26', secondsByRule: { r: undefined } } })
    expect(
      decide(makeRuleset({ rules: [budgeted('r')] }), page, state, NOW, fixtureCatalog())
    ).toMatchObject({
      access: 'allow',
    })
  })

  it.each(MEMBER_IDS)('the_escalation_group_%s_is_its_own_state', (id) => {
    const friction = makeRule({
      id,
      mode: 'friction',
      target: { kind: 'site', domain: 'news.example.org' },
    })
    const state = makeState({
      escalation: [
        makeEscalation(id, { phase: 'active', intentionExpiresAt: '2026-10-26T10:05:00Z' }),
      ],
    })
    expect(
      decide(makeRuleset({ rules: [friction] }), page, state, NOW, fixtureCatalog())
    ).toMatchObject({
      access: 'allow',
      reason: 'intention_active',
      ruleId: id,
    })
  })

  it('an_alias_named_like_a_prototype_member_is_an_ordinary_alias', () => {
    const catalog = createRulesCatalog({
      siteProfiles: [
        {
          schemaVersion: 1,
          domain: 'video.example',
          aliases: ['constructor.example'],
          spaNavigation: 'history',
          surfaces: {},
        },
      ],
      surfaces: [],
      defaultCategories: [],
    })
    expect(catalog.normaliseDomain('www.constructor.example')).toBe('video.example')
    expect(catalog.normaliseDomain('tostring.example')).toBe('tostring.example')
  })
})
