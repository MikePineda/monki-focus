// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '@monki-focus/rules/pure'
import { describe, expect, it } from 'vitest'
import { BEDTIME_GROUP, groupOf } from '../../../../src/background/gate/GateGroup'

function decision(overrides: Partial<Decision>): Decision {
  return {
    access: 'allow',
    content: 'show',
    ruleId: null,
    reason: 'no_rule',
    explanationKey: 'decision.no_rule',
    validUntil: '2026-01-10T00:00:00Z',
    ...overrides,
  }
}

describe('groupOf', () => {
  it('a_rule_decision_belongs_to_its_rule', () => {
    expect(groupOf(decision({ ruleId: 'r-news', reason: 'intention_required' }))).toBe('r-news')
  })

  it.each([
    'schedule_bedtime',
    'emergency_active',
    'intention_required',
    'intention_active',
  ] as const)('a_%s_decision_without_a_rule_belongs_to_bedtime', (reason) => {
    expect(groupOf(decision({ reason }))).toBe(BEDTIME_GROUP)
  })

  it('no_rule_has_no_group', () => {
    expect(groupOf(decision({}))).toBeNull()
  })
})
