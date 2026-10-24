// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Rule } from '@monki-focus/rules/pure'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import {
  PENDING_RULESET_KEY,
  PendingRuleChangeStore,
} from '../../../../src/background/rules/PendingRuleChangeStore'
import { RuleChangeService } from '../../../../src/background/rules/RuleChangeService'
import { RULESET_KEY, RulesetStore } from '../../../../src/background/rules/RulesetStore'
import { bundledRulesCatalog } from '../../../../src/shared/bundledRulesCatalog'
import type { PendingRuleChange } from '../../../../src/shared/RuleChangeContract'
import { makeRule, makeRuleset } from '../../../factories/makeRuleset'
import { ManualClock } from '../../../support/ManualClock'

// 10:00Z: local midnight at UTC+2 (Etc/GMT-2) is 22:00Z; at UTC+13 (Etc/GMT-13) it is 11:00Z.
const NOW = '2026-10-27T10:00:00Z'
const NORMAL_MIDNIGHT = '2026-10-27T22:00:00Z'

async function stored<T>(key: string): Promise<T | undefined> {
  return (await fakeBrowser.storage.local.get(key))[key] as T | undefined
}

async function makeService(effective: unknown, pending?: PendingRuleChange) {
  await fakeBrowser.storage.local.set({ [RULESET_KEY]: effective })
  if (pending) await fakeBrowser.storage.local.set({ [PENDING_RULESET_KEY]: pending })
  return new RuleChangeService({
    rulesets: new RulesetStore({ storage: fakeBrowser.storage.local, deviceTimeZone: () => 'UTC' }),
    pending: new PendingRuleChangeStore(fakeBrowser.storage.local),
    catalog: bundledRulesCatalog(),
    clock: new ManualClock(NOW),
  })
}

function blocks(prefix: string, count: number): Rule[] {
  return Array.from({ length: count }, (_value, index) =>
    makeRule({
      id: `${prefix}-${String(index).padStart(3, '0')}`,
      target: { kind: 'site', domain: `${prefix}${index}.example` },
      mode: 'block',
    })
  )
}

describe('rule changes never loosen early', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('a_change_whose_effective_set_would_be_invalid_is_rejected_and_nothing_is_saved', async () => {
    // 500 blocks replaced by 500 others in a far-ahead zone: today would need
    // the old ones (removal waits) and the new ones (tightening) = 1000 rules.
    const effective = makeRuleset({ rules: blocks('old', 500) })
    const service = await makeService(effective)

    const outcome = await service.propose({
      ruleset: makeRuleset({ rules: blocks('new', 500), timeZone: 'Etc/GMT-13' }),
      baseRevision: 1,
    })

    expect(outcome).toEqual({ status: 'rejected', code: 'too_many_rules' })
    expect(await stored(RULESET_KEY)).toEqual(effective)
    expect(await stored(PENDING_RULESET_KEY)).toBeUndefined()
  })

  it('an_unreadable_stored_set_never_waits_less_than_its_own_zone_midnight', async () => {
    // A stored set that fails validation (501 rules) in UTC+2, a proposal in UTC+13.
    const invalid = makeRuleset({ rules: blocks('old', 501) })
    const service = await makeService(invalid)

    const outcome = await service.propose({
      ruleset: makeRuleset({ timeZone: 'Etc/GMT-13' }),
      baseRevision: 1,
    })

    expect(outcome).toMatchObject({ status: 'pending', effectiveFrom: NORMAL_MIDNIGHT })
    expect(await stored(RULESET_KEY)).toEqual(invalid)
  })

  it('an_unresolvable_stored_zone_waits_a_full_day', async () => {
    const service = await makeService({ ...makeRuleset(), timeZone: 'Mars/Olympus' })

    const outcome = await service.propose({ ruleset: makeRuleset(), baseRevision: 1 })

    expect(outcome).toMatchObject({ status: 'pending', effectiveFrom: '2026-10-28T10:00:00Z' })
  })

  it('the_fallback_never_moves_a_pending_effective_from_earlier', async () => {
    const later = '2026-10-30T05:00:00Z'
    const service = await makeService(
      { ...makeRuleset(), rules: blocks('old', 501) },
      { ruleset: makeRuleset(), effectiveFrom: later }
    )

    const outcome = await service.propose({ ruleset: makeRuleset(), baseRevision: 1 })

    expect(outcome).toMatchObject({ status: 'pending', effectiveFrom: later })
  })

  it('every_proposal_is_held_to_the_256_kib_document_limit', async () => {
    const service = await makeService(makeRuleset())
    const huge = makeRuleset({
      rules: blocks('big', 500).map((rule) => ({ ...rule, note: 'n'.repeat(140) })),
      categories: Array.from({ length: 2000 }, (_value, index) => ({
        target: { kind: 'site' as const, domain: `category${index}.example` },
        level: 0 as const,
        category: 'social',
      })),
    })

    const outcome = await service.propose({ ruleset: huge, baseRevision: 1 })

    expect(outcome).toEqual({ status: 'rejected', code: 'too_large' })
    expect(await stored(PENDING_RULESET_KEY)).toBeUndefined()
  })
})

describe('cancelling a pending change', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('cancelling_bumps_the_revision_so_stale_pages_are_refused', async () => {
    const service = await makeService(makeRuleset())
    const looser = makeRuleset({ rules: [makeRule({ dailyBudgetMinutes: 60 })] })
    await service.propose({ ruleset: looser, baseRevision: 1 })

    const state = await service.cancelPending()

    expect(state.effective.revision).toBe(3)
    expect(state.effective.rules[0]?.dailyBudgetMinutes).toBe(30)
    expect(await service.propose({ ruleset: looser, baseRevision: 2 })).toEqual({
      status: 'rejected',
      code: 'stale_revision',
    })
  })

  it('cancelling_a_waiting_time_zone_change_keeps_both_zones_until_it_would_have_applied', async () => {
    const service = await makeService(makeRuleset())
    const proposed = await service.propose({
      ruleset: makeRuleset({ timeZone: 'Etc/GMT-5' }),
      baseRevision: 1,
    })
    if (proposed.status !== 'pending') throw new Error('a zone change waits')

    const state = await service.cancelPending()

    // Dropping the second zone is a loosening: it waits for the cancelled change's time.
    expect(state.effective).toMatchObject({ timeZone: 'Etc/GMT-2', pendingTimeZone: 'Etc/GMT-5' })
    expect(state.pending?.effectiveFrom).toBe(proposed.effectiveFrom)
    expect(state.pending?.ruleset.timeZone).toBe('Etc/GMT-2')
    expect(state.pending?.ruleset).not.toHaveProperty('pendingTimeZone')
    expect(state.pending?.ruleset.revision).toBe(state.effective.revision)
  })

  it('cancelling_without_a_pending_change_changes_nothing', async () => {
    const service = await makeService(makeRuleset())

    const state = await service.cancelPending()

    expect(state).toEqual({ effective: makeRuleset(), pending: null })
  })
})

describe('a waiting second time zone is never dropped early', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  async function waitingZoneChange() {
    const service = await makeService(makeRuleset())
    const proposed = await service.propose({
      ruleset: makeRuleset({ timeZone: 'Etc/GMT-5' }),
      baseRevision: 1,
    })
    if (proposed.status !== 'pending') throw new Error('a zone change waits')
    return { service, zoneFrom: proposed.effectiveFrom }
  }

  const tighter = (revision: number) =>
    makeRuleset({ revision, rules: [makeRule({ dailyBudgetMinutes: 10 })] })

  it('a_tightening_saved_after_a_cancel_keeps_both_zones_until_the_removal_is_due', async () => {
    const { service, zoneFrom } = await waitingZoneChange()
    const cancelled = await service.cancelPending()

    const outcome = await service.propose({
      ruleset: { ...tighter(0), timeZone: 'Etc/GMT-2' },
      baseRevision: cancelled.effective.revision,
    })

    expect(outcome).toMatchObject({ status: 'pending', effectiveFrom: zoneFrom })
    if (outcome.status !== 'pending') return
    expect(outcome.state.effective).toMatchObject({
      timeZone: 'Etc/GMT-2',
      pendingTimeZone: 'Etc/GMT-5',
      rules: [{ dailyBudgetMinutes: 10 }],
    })
    expect(outcome.state.pending?.ruleset).not.toHaveProperty('pendingTimeZone')
  })

  it('reverting_to_the_old_zone_while_the_change_waits_keeps_both_zones_until_it_was_due', async () => {
    const { service, zoneFrom } = await waitingZoneChange()

    const outcome = await service.propose({ ruleset: tighter(0), baseRevision: 2 })

    expect(outcome).toMatchObject({ status: 'pending', effectiveFrom: zoneFrom })
    if (outcome.status !== 'pending') return
    expect(outcome.state.effective).toMatchObject({
      timeZone: 'Etc/GMT-2',
      pendingTimeZone: 'Etc/GMT-5',
    })
    expect(await stored(PENDING_RULESET_KEY)).toMatchObject({ effectiveFrom: zoneFrom })
  })
})
