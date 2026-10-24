// SPDX-License-Identifier: AGPL-3.0-or-later
import { ENGINE_ERROR_DECISION } from '@monki-focus/engine'
import { describe, expect, it, vi } from 'vitest'
import {
  createCommandHandlers,
  type CommandDependencies,
} from '../../../../src/background/commands/commands'
import { bundledRulesCatalog } from '../../../../src/shared/bundledRulesCatalog'
import { fixedClock } from '../../../../src/shared/clock'

const sender = { id: 'own', url: 'chrome-extension://own/popup.html' }

function makeHandlers(extra: Partial<CommandDependencies> = {}) {
  return createCommandHandlers({
    clock: fixedClock('2026-10-27T12:00:00Z'),
    catalog: bundledRulesCatalog(),
    decisions: {
      feedDecisionFor: () =>
        Promise.resolve({
          surface: null,
          decision: { ...ENGINE_ERROR_DECISION },
          hide: [],
          restrict: [],
        }),
    },
    tracking: {
      today: () => Promise.reject(new Error('not used')),
      week: () => Promise.reject(new Error('not used')),
      incognitoAccess: () => Promise.reject(new Error('not used')),
    },
    ...extra,
  })
}

describe('page commands', () => {
  it('without_the_intention_gate_intentions_are_unavailable', async () => {
    const handlers = makeHandlers()

    expect(await handlers['intention.active']({}, sender)).toEqual({
      available: false,
      active: null,
    })
    expect(await handlers['intention.log']({}, sender)).toEqual({ available: false, entries: [] })
    expect(await handlers['intention.end']({ targetGroup: 'r-x' }, sender)).toEqual({
      ended: false,
    })
  })

  it('the_intention_gate_answers_once_plugged_in', async () => {
    const active = { targetGroup: 'r-x', site: 'x.com', text: null, expiresAt: 1 }
    const end = vi.fn(() => Promise.resolve(true))
    const handlers = makeHandlers({
      intentions: { active: () => Promise.resolve(active), end, log: () => Promise.resolve([]) },
    })

    expect(await handlers['intention.active']({}, sender)).toEqual({ available: true, active })
    expect(await handlers['intention.end']({ targetGroup: 'r-x' }, sender)).toEqual({
      ended: true,
    })
    expect(end).toHaveBeenCalledWith('r-x')
  })

  it('a_command_whose_service_is_not_wired_fails', async () => {
    const handlers = makeHandlers()

    await expect(
      Promise.resolve().then(() => handlers['rules.state']({}, sender))
    ).rejects.toThrow()
  })

  it('rule_preference_and_data_commands_reach_their_services', async () => {
    const state = { effective: {} as never, pending: null }
    const rules = {
      state: vi.fn(() => Promise.resolve(state)),
      propose: vi.fn(() => Promise.resolve({ status: 'applied' as const, state })),
      cancelPending: vi.fn(() => Promise.resolve(state)),
    }
    const localData = {
      export: vi.fn(() => Promise.resolve({ fileName: 'f', mimeType: 'text/csv', text: '' })),
      deleteAll: vi.fn(() => Promise.resolve({ stores: [] })),
    }
    const handlers = makeHandlers({ rules, localData })

    await handlers['rules.propose']({ ruleset: {} as never, baseRevision: 3 }, sender)
    await handlers['data.export']({ format: 'csv' }, sender)
    await handlers['data.deleteAll']({}, sender)

    expect(rules.propose).toHaveBeenCalledWith({ ruleset: {}, baseRevision: 3 })
    expect(localData.export).toHaveBeenCalledWith('csv')
    expect(localData.deleteAll).toHaveBeenCalledOnce()
  })
})
