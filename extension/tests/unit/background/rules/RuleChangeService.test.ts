// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ruleset } from '@monki-focus/rules/pure'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import {
  PENDING_RULESET_KEY,
  PendingRuleChangeStore,
} from '../../../../src/background/rules/PendingRuleChangeStore'
import {
  PENDING_RULES_ALARM,
  RuleChangeService,
  pendingRulesAlarm,
} from '../../../../src/background/rules/RuleChangeService'
import { RULESET_KEY, RulesetStore } from '../../../../src/background/rules/RulesetStore'
import { bundledRulesCatalog } from '../../../../src/shared/bundledRulesCatalog'
import { makeRule, makeRuleset } from '../../../factories/makeRuleset'
import { ManualClock } from '../../../support/ManualClock'

const catalog = bundledRulesCatalog()

async function storedEffective(): Promise<Ruleset> {
  return (await fakeBrowser.storage.local.get(RULESET_KEY))[RULESET_KEY] as Ruleset
}

async function storedPending(): Promise<unknown> {
  return (await fakeBrowser.storage.local.get(PENDING_RULESET_KEY))[PENDING_RULESET_KEY]
}

async function makeService(initial: Ruleset = makeRuleset(), at = '2026-10-27T10:00:00Z') {
  await fakeBrowser.storage.local.set({ [RULESET_KEY]: initial })
  const clock = new ManualClock(at)
  const onPendingChanged = vi.fn()
  const service = new RuleChangeService({
    rulesets: new RulesetStore({ storage: fakeBrowser.storage.local, deviceTimeZone: () => 'UTC' }),
    pending: new PendingRuleChangeStore(fakeBrowser.storage.local),
    catalog,
    clock,
    onPendingChanged,
  })
  return { service, clock, onPendingChanged }
}

function withBudget(ruleset: Ruleset, minutes: number | undefined): Ruleset {
  const [rule] = ruleset.rules
  if (!rule) throw new Error('needs a rule')
  const changed = { ...rule }
  if (minutes === undefined) delete changed.dailyBudgetMinutes
  else changed.dailyBudgetMinutes = minutes
  return { ...ruleset, rules: [changed, ...ruleset.rules.slice(1)] }
}

describe('RuleChangeService', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('tightening_a_rule_applies_immediately', async () => {
    const { service } = await makeService()

    const outcome = await service.propose({
      ruleset: withBudget(makeRuleset(), 15),
      baseRevision: 1,
    })

    expect(outcome.status).toBe('applied')
    expect((await storedEffective()).rules[0]?.dailyBudgetMinutes).toBe(15)
    expect(await storedPending()).toBeUndefined()
  })

  it('loosening_a_rule_waits_until_the_next_local_midnight', async () => {
    const { service, onPendingChanged } = await makeService()

    const outcome = await service.propose({
      ruleset: withBudget(makeRuleset(), 60),
      baseRevision: 1,
    })

    // 10:00Z is 12:00 at UTC+2; the next local midnight is 22:00Z.
    expect(outcome).toMatchObject({ status: 'pending', effectiveFrom: '2026-10-27T22:00:00Z' })
    expect((await storedEffective()).rules[0]?.dailyBudgetMinutes).toBe(30)
    expect(await storedPending()).toMatchObject({
      effectiveFrom: '2026-10-27T22:00:00Z',
      ruleset: { rules: [{ dailyBudgetMinutes: 60 }] },
    })
    expect(onPendingChanged).toHaveBeenLastCalledWith('2026-10-27T22:00:00Z')
  })

  it('a_mixed_change_applies_the_tightening_now_and_keeps_the_loosening_pending', async () => {
    const { service } = await makeService()
    const block = makeRule({ id: 'site-other', target: { kind: 'site', domain: 'other.example' } })
    const proposed = withBudget(makeRuleset(), 60)
    proposed.rules.push({ ...block, mode: 'block' })

    const outcome = await service.propose({ ruleset: proposed, baseRevision: 1 })

    expect(outcome.status).toBe('pending')
    const effective = await storedEffective()
    expect(effective.rules.map((rule) => [rule.id, rule.dailyBudgetMinutes, rule.mode])).toEqual([
      ['site-example', 30, 'friction'],
      ['site-other', undefined, 'block'],
    ])
  })

  it('cancelling_a_pending_loosening_keeps_what_applies_now', async () => {
    const { service, onPendingChanged } = await makeService()
    await service.propose({ ruleset: withBudget(makeRuleset(), 60), baseRevision: 1 })
    const effectiveBefore = await storedEffective()

    const state = await service.cancelPending()

    expect(state.pending).toBeNull()
    expect(await storedPending()).toBeUndefined()
    expect(await storedEffective()).toEqual(effectiveBefore)
    expect(onPendingChanged).toHaveBeenLastCalledWith(null)
  })

  it('turning_bedtime_off_during_bedtime_waits_until_it_ends', async () => {
    // 21:30Z is 23:30 local, inside the 22:30–07:00 window: it ends at 05:00Z.
    const { service } = await makeService(makeRuleset(), '2026-10-27T21:30:00Z')
    const proposed = makeRuleset()
    proposed.bedtime = { ...proposed.bedtime, enabled: false }

    const outcome = await service.propose({ ruleset: proposed, baseRevision: 1 })

    expect(outcome).toMatchObject({ status: 'pending', effectiveFrom: '2026-10-28T05:00:00Z' })
  })

  it('a_later_change_never_brings_a_pending_effective_from_forward', async () => {
    const { service } = await makeService(makeRuleset(), '2026-10-27T21:30:00Z')
    const bedtimeOff = makeRuleset()
    bedtimeOff.bedtime = { ...bedtimeOff.bedtime, enabled: false }
    await service.propose({ ruleset: bedtimeOff, baseRevision: 1 })

    // Bedtime back on, a budget raised instead: alone it would wait for 22:00Z.
    const outcome = await service.propose({
      ruleset: withBudget(makeRuleset(), 60),
      baseRevision: 2,
    })

    expect(outcome).toMatchObject({ status: 'pending', effectiveFrom: '2026-10-28T05:00:00Z' })
  })

  it('reverting_every_pending_part_clears_the_pending_change', async () => {
    const { service } = await makeService()
    await service.propose({ ruleset: withBudget(makeRuleset(), 60), baseRevision: 1 })

    const outcome = await service.propose({ ruleset: makeRuleset(), baseRevision: 2 })

    expect(outcome.status).toBe('applied')
    expect(await storedPending()).toBeUndefined()
  })

  it('a_pending_change_takes_full_effect_once_its_time_has_come', async () => {
    const { service, clock, onPendingChanged } = await makeService()
    await service.propose({ ruleset: withBudget(makeRuleset(), 60), baseRevision: 1 })

    clock.set('2026-10-27T21:59:59Z')
    expect(await service.promoteIfDue()).toBe(false)
    expect((await storedEffective()).rules[0]?.dailyBudgetMinutes).toBe(30)

    clock.set('2026-10-27T22:00:00Z')
    expect(await service.promoteIfDue()).toBe(true)
    expect((await storedEffective()).rules[0]?.dailyBudgetMinutes).toBe(60)
    expect(await storedPending()).toBeUndefined()
    expect(onPendingChanged).toHaveBeenLastCalledWith(null)
  })

  it('reading_the_state_promotes_a_due_change_first', async () => {
    const { service, clock } = await makeService()
    await service.propose({ ruleset: withBudget(makeRuleset(), 60), baseRevision: 1 })
    clock.set('2026-10-28T08:00:00Z')

    const state = await service.state()

    expect(state.pending).toBeNull()
    expect(state.effective.rules[0]?.dailyBudgetMinutes).toBe(60)
  })

  it('every_saved_change_gets_the_next_revision_and_the_current_time', async () => {
    const { service } = await makeService()

    await service.propose({ ruleset: withBudget(makeRuleset(), 15), baseRevision: 1 })

    expect(await storedEffective()).toMatchObject({
      revision: 2,
      updatedAt: '2026-10-27T10:00:00Z',
    })
  })

  it('an_invalid_proposal_is_rejected_and_nothing_is_stored', async () => {
    const { service } = await makeService()
    const proposed = makeRuleset({ timeZone: 'Mars/Olympus' })

    const outcome = await service.propose({ ruleset: proposed, baseRevision: 1 })

    expect(outcome).toEqual({ status: 'rejected', code: 'invalid_time_zone' })
    expect(await storedEffective()).toEqual(makeRuleset())
    expect(await storedPending()).toBeUndefined()
  })

  it('a_proposal_from_a_stale_page_is_rejected', async () => {
    const { service } = await makeService()
    await service.propose({ ruleset: withBudget(makeRuleset(), 15), baseRevision: 1 })

    const outcome = await service.propose({
      ruleset: withBudget(makeRuleset(), 10),
      baseRevision: 1,
    })

    expect(outcome).toEqual({ status: 'rejected', code: 'stale_revision' })
  })

  it('an_unreadable_stored_rule_set_makes_any_change_wait_for_midnight', async () => {
    const { service } = await makeService({ broken: true } as unknown as Ruleset)

    const outcome = await service.propose({ ruleset: makeRuleset(), baseRevision: 0 })

    expect(outcome).toMatchObject({ status: 'pending', effectiveFrom: '2026-10-27T22:00:00Z' })
  })

  it('the_pending_alarm_follows_effective_from', async () => {
    const alarms = { create: vi.fn(), clear: vi.fn() }
    const onPendingChanged = pendingRulesAlarm(alarms)

    await onPendingChanged('2026-10-27T22:00:00Z')
    await onPendingChanged(null)

    expect(alarms.create).toHaveBeenCalledWith(PENDING_RULES_ALARM, {
      when: Date.parse('2026-10-27T22:00:00Z'),
    })
    expect(alarms.clear).toHaveBeenCalledWith(PENDING_RULES_ALARM)
  })
})
