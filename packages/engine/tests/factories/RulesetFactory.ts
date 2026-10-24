// SPDX-License-Identifier: AGPL-3.0-or-later
/** Builders for synthetic rule sets, rules and decision state (generic zones and domains only). */
import type { DecisionState, EscalationState, Rule, Ruleset } from '@monki-focus/rules'
import { initialEscalationState } from '../../src/index.ts'

export function makeRule(overrides: Partial<Rule> & Pick<Rule, 'id'>): Rule {
  return {
    target: { kind: 'site', domain: 'example.org' },
    mode: 'block',
    schedules: [],
    enabled: true,
    ...overrides,
  }
}

export function makeRuleset(overrides: Partial<Ruleset> = {}): Ruleset {
  return {
    schemaVersion: 1,
    revision: 1,
    updatedAt: '2026-01-01T00:00:00Z',
    timeZone: 'UTC',
    rules: [],
    categories: [],
    bedtime: {
      enabled: false,
      days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      start: '22:30',
      end: '07:00',
      warnMinutesBefore: 30,
    },
    workHours: { days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '09:00', end: '17:30' },
    ...overrides,
  }
}

export function makeState(overrides: Partial<DecisionState> = {}): DecisionState {
  return { escalation: [], usage: null, unlocks: [], guardianLinked: false, ...overrides }
}

export function makeEscalation(
  targetGroup: string,
  overrides: Partial<EscalationState> = {}
): EscalationState {
  return { ...initialEscalationState(targetGroup), ...overrides }
}
