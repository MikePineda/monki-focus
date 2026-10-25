// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DailyUsage, Ruleset } from '@monki-focus/rules/pure'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import {
  RESTRICTION_SNAPSHOT_NAME,
  RestrictionWatcher,
} from '../../../../src/background/decisions/RestrictionWatcher'
import { ManualClock } from '../../../support/ManualClock'
import { gatedRuleset } from '../../../support/gateHarness'

/** The gated starter rule set with one Reddit friction rule limited to 09:00–13:00 UTC. */
function morningRuleset(): Ruleset {
  const ruleset = gatedRuleset()
  return {
    ...ruleset,
    rules: ruleset.rules.map((rule) =>
      rule.id === 'starter-reddit-friction'
        ? {
            ...rule,
            schedules: [
              {
                days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
                start: '09:00',
                end: '13:00',
              },
            ],
          }
        : rule
    ),
  }
}

function makeWatcher(
  clock: ManualClock,
  ruleset: { current: Ruleset },
  usage: { current: DailyUsage | null } = { current: null }
) {
  const onChange = vi.fn()
  const watcher = new RestrictionWatcher({
    rulesets: { load: () => Promise.resolve(ruleset.current) },
    clock,
    usage: () => Promise.resolve(usage.current),
    storage: fakeBrowser.storage.session,
    onChange,
  })
  return { watcher, onChange }
}

async function snapshot(): Promise<unknown> {
  return (await fakeBrowser.storage.session.get(RESTRICTION_SNAPSHOT_NAME))[
    RESTRICTION_SNAPSHOT_NAME
  ]
}

describe('RestrictionWatcher', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('the_first_check_only_records_the_rules_in_force', async () => {
    const clock = new ManualClock('2026-01-05T10:00:00Z')
    const { watcher, onChange } = makeWatcher(clock, { current: morningRuleset() })

    expect(await watcher.check()).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
    expect(await snapshot()).toContain('starter-reddit-friction')
  })

  it('a_schedule_edge_that_changes_the_rules_in_force_notifies', async () => {
    const clock = new ManualClock('2026-01-05T12:59:00Z')
    const { watcher, onChange } = makeWatcher(clock, { current: morningRuleset() })
    await watcher.check()

    clock.advanceSeconds(60)

    expect(await watcher.check()).toBe(true)
    expect(onChange).toHaveBeenCalledOnce()
    expect(await snapshot()).not.toContain('starter-reddit-friction')
  })

  it('a_minute_without_an_edge_stays_quiet', async () => {
    const clock = new ManualClock('2026-01-05T10:00:00Z')
    const { watcher, onChange } = makeWatcher(clock, { current: morningRuleset() })
    await watcher.check()

    clock.advanceSeconds(60)

    expect(await watcher.check()).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('local_midnight_and_bedtime_count_as_changes', async () => {
    const clock = new ManualClock('2026-01-05T23:59:00Z')
    const ruleset = { current: morningRuleset() }
    const { watcher, onChange } = makeWatcher(clock, ruleset)
    await watcher.check()

    clock.advanceSeconds(60)
    expect(await watcher.check()).toBe(true)

    ruleset.current = gatedRuleset({
      bedtime: { ...gatedRuleset().bedtime, enabled: true, start: '00:01', end: '07:00' },
    })
    await watcher.check()
    onChange.mockClear()
    clock.advanceSeconds(60)
    expect(await watcher.check()).toBe(true)
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('a_budget_running_out_while_a_page_stays_open_notifies', async () => {
    const clock = new ManualClock('2026-01-05T10:00:00Z')
    const base = gatedRuleset()
    const ruleset = {
      current: {
        ...base,
        rules: base.rules.map((rule) =>
          rule.id === 'starter-reddit-friction' ? { ...rule, dailyBudgetMinutes: 30 } : rule
        ),
      },
    }
    const usage = {
      current: { localDate: '2026-01-05', secondsByRule: { 'starter-reddit-friction': 1_740 } },
    }
    const { watcher, onChange } = makeWatcher(clock, ruleset, usage)
    await watcher.check()

    usage.current = { localDate: '2026-01-05', secondsByRule: { 'starter-reddit-friction': 1_800 } }
    clock.advanceSeconds(60)

    expect(await watcher.check()).toBe(true)
    expect(onChange).toHaveBeenCalledOnce()
    expect(await snapshot()).toContain('exhausted starter-reddit-friction')
  })

  it('usage_of_another_day_spends_no_budget', async () => {
    const clock = new ManualClock('2026-01-05T10:00:00Z')
    const base = gatedRuleset()
    const ruleset = {
      current: {
        ...base,
        rules: base.rules.map((rule) =>
          rule.id === 'starter-reddit-friction' ? { ...rule, dailyBudgetMinutes: 30 } : rule
        ),
      },
    }
    const usage = {
      current: { localDate: '2026-01-04', secondsByRule: { 'starter-reddit-friction': 9_000 } },
    }
    const { watcher } = makeWatcher(clock, ruleset, usage)
    await watcher.check()

    expect(await snapshot()).not.toContain('exhausted starter-reddit-friction')
  })

  it('a_restarted_worker_still_sees_the_change', async () => {
    const clock = new ManualClock('2026-01-05T12:59:00Z')
    const ruleset = { current: morningRuleset() }
    await makeWatcher(clock, ruleset).watcher.check()
    clock.advanceSeconds(60)

    const { watcher, onChange } = makeWatcher(clock, ruleset)

    expect(await watcher.check()).toBe(true)
    expect(onChange).toHaveBeenCalledOnce()
  })
})
