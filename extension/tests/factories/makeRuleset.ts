// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Rule, Ruleset } from '@monki-focus/rules/pure'

/** A synthetic rule (`makeRule({ mode: 'block' })`); site target by default. */
export function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'site-example',
    target: { kind: 'site', domain: 'example.com' },
    mode: 'friction',
    schedules: [],
    enabled: true,
    ...overrides,
  }
}

/**
 * A synthetic rule set pinned to `Etc/GMT-2` (UTC+2 all year, so local
 * midnight is always 22:00Z): one budgeted friction rule on example.com,
 * bedtime 22:30–07:00 every day, work hours Mon–Fri 09:00–17:30.
 */
export function makeRuleset(overrides: Partial<Ruleset> = {}): Ruleset {
  return {
    schemaVersion: 1,
    revision: 1,
    updatedAt: '2026-10-01T00:00:00Z',
    timeZone: 'Etc/GMT-2',
    rules: [makeRule({ dailyBudgetMinutes: 30 })],
    categories: [],
    bedtime: {
      enabled: true,
      days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      start: '22:30',
      end: '07:00',
      warnMinutesBefore: 30,
    },
    workHours: { days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '09:00', end: '17:30' },
    ...overrides,
  }
}
