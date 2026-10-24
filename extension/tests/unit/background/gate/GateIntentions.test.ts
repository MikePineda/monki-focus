// SPDX-License-Identifier: AGPL-3.0-or-later
import { initialEscalationState } from '@monki-focus/engine'
import type { EscalationState } from '@monki-focus/rules/pure'
import { describe, expect, it, vi } from 'vitest'
import { GateIntentions } from '../../../../src/background/gate/GateIntentions'
import type { IntentionEntry } from '../../../../src/background/storage/db'
import { fixedClock } from '../../../../src/shared/clock'
import { makeRule, makeRuleset } from '../../../factories/makeRuleset'

const NOW = '2026-10-27T10:00:00Z'

function active(group: string, expiresAt: string): EscalationState {
  return { ...initialEscalationState(group), phase: 'active', intentionExpiresAt: expiresAt }
}

function makeIntentions({
  states = [] as EscalationState[],
  entries = [] as IntentionEntry[],
  endEarly = vi.fn(() => Promise.resolve(true)),
} = {}) {
  const ruleset = makeRuleset({
    rules: [makeRule({ id: 'r-news', target: { kind: 'site', domain: 'news.example' } })],
  })
  const between = vi.fn(() => Promise.resolve(entries))
  return {
    intentions: new GateIntentions({
      clock: fixedClock(NOW),
      rulesets: { load: () => Promise.resolve(ruleset) },
      escalation: { all: () => Promise.resolve(states) },
      notes: {
        of: (group) =>
          Promise.resolve(group === 'r-news' ? { text: 'Read one article', minutes: 10 } : null),
      },
      log: () => Promise.resolve({ between }),
      endEarly,
    }),
    between,
    endEarly,
  }
}

describe('GateIntentions', () => {
  it('the_running_intention_is_the_one_that_ends_first', async () => {
    const { intentions } = makeIntentions({
      states: [
        active('r-later', '2026-10-27T10:14:00Z'),
        active('r-news', '2026-10-27T10:04:05Z'),
        active('r-over', '2026-10-27T09:59:00Z'),
        { ...initialEscalationState('r-idle') },
      ],
    })

    expect(await intentions.active()).toEqual({
      targetGroup: 'r-news',
      site: 'news.example',
      text: 'Read one article',
      expiresAt: Date.parse('2026-10-27T10:04:05Z'),
    })
  })

  it('no_active_intention_answers_null', async () => {
    expect(await makeIntentions().intentions.active()).toBeNull()
  })

  it('end_now_goes_through_the_gate_controller', async () => {
    const { intentions, endEarly } = makeIntentions()

    expect(await intentions.end('r-news')).toBe(true)
    expect(endEarly).toHaveBeenCalledWith('r-news')
  })

  it('the_log_lists_outcomes_of_the_last_week_most_recent_first_without_text', async () => {
    const { intentions, between } = makeIntentions({
      entries: [
        { at: '2026-10-26T08:00:00Z', kind: 'visit', group: 'r-news' },
        { at: '2026-10-26T08:01:00Z', kind: 'committed', group: 'r-news' },
        { at: '2026-10-26T08:11:00Z', kind: 'kept', group: 'r-news' },
        { at: '2026-10-27T09:00:00Z', kind: 'broken', group: 'bedtime' },
        { at: '2026-10-27T09:30:00Z', kind: 'closed', group: 'r-news' },
      ],
    })

    const log = await intentions.log()

    expect(between).toHaveBeenCalledWith('2026-10-20T10:00:00Z', '2026-10-27T10:00:01Z')
    expect(log).toEqual([
      {
        at: Date.parse('2026-10-27T09:30:00Z'),
        site: 'news.example',
        text: null,
        minutes: null,
        outcome: 'closed',
      },
      {
        at: Date.parse('2026-10-27T09:00:00Z'),
        site: null,
        text: null,
        minutes: null,
        outcome: 'broken',
      },
      {
        at: Date.parse('2026-10-26T08:11:00Z'),
        site: 'news.example',
        text: null,
        minutes: null,
        outcome: 'on_time',
      },
    ])
  })
})
