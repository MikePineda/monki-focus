// SPDX-License-Identifier: AGPL-3.0-or-later
import { ENGINE_ERROR_DECISION } from '@monki-focus/engine'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import {
  GateRedirectRules,
  REDIRECT_RULE_FIRST_ID,
  type GateDnrRule,
} from '../../../../src/background/gate/GateRedirectRules'
import { bundledRulesCatalog } from '../../../../src/shared/bundledRulesCatalog'
import { REDDIT_GROUP, TAB, gateHarness } from '../../../support/gateHarness'

const TICKET = 'abcdefghijklmnopqrstuvwxyzabcdef'

function fakeDnr() {
  let rules: GateDnrRule[] = []
  const api = {
    getSessionRules: vi.fn(() => Promise.resolve(rules.map((rule) => ({ ...rule })))),
    updateSessionRules: vi.fn((options: { removeRuleIds?: number[]; addRules?: GateDnrRule[] }) => {
      rules = rules.filter((rule) => !(options.removeRuleIds ?? []).includes(rule.id))
      rules.push(...(options.addRules ?? []))
      return Promise.resolve()
    }),
  }
  return { api, rules: () => rules }
}

function redirects(harness: ReturnType<typeof gateHarness>, dnr = fakeDnr()) {
  const sync = new GateRedirectRules({
    dnr: dnr.api,
    catalog: bundledRulesCatalog(),
    rulesets: { load: () => Promise.resolve(harness.state.ruleset) },
    decide: (url) => harness.decisions.decide(url),
    ticket: () => Promise.resolve(TICKET),
    runtimeId: 'test-extension',
  })
  return { sync, dnr }
}

describe('GateRedirectRules', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('each_gated_group_gets_one_redirect_for_its_domains_and_aliases', async () => {
    const { sync, dnr } = redirects(gateHarness())

    expect(await sync.sync()).toBe(true)

    expect(dnr.rules()).toEqual([
      {
        id: REDIRECT_RULE_FIRST_ID,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            regexSubstitution: `chrome-extension://test-extension/gate.html?t=${TICKET}&to=\\0`,
          },
        },
        condition: {
          regexFilter: '^https?://.*$',
          requestDomains: ['reddit.com'],
          resourceTypes: ['main_frame'],
        },
      },
      expect.objectContaining({
        id: REDIRECT_RULE_FIRST_ID + 1,
        condition: expect.objectContaining({ requestDomains: ['twitter.com', 'x.com'] }),
      }),
    ])
  })

  it('an_unchanged_decision_leaves_the_browser_alone', async () => {
    const { sync, dnr } = redirects(gateHarness())
    await sync.sync()

    expect(await sync.sync()).toBe(false)
    expect(dnr.api.updateSessionRules).toHaveBeenCalledTimes(1)
  })

  it('a_committed_intention_lifts_its_group_redirect_and_expiry_restores_it', async () => {
    const harness = gateHarness()
    const { sync, dnr } = redirects(harness)
    await sync.sync()
    const view = await harness.controller.load(
      TAB,
      await harness.handoff('https://www.reddit.com/')
    )
    harness.clock.advanceSeconds(view.kind === 'friction' ? view.gate.pauseSeconds : 0)
    await harness.controller.pauseDone(TAB)
    await harness.controller.commit(TAB, 5, '')

    await sync.sync()
    expect(dnr.rules().map((rule) => rule.condition.requestDomains)).toEqual([
      ['twitter.com', 'x.com'],
    ])

    harness.clock.advanceSeconds(300)
    await sync.sync()
    expect(dnr.rules().map((rule) => rule.condition.requestDomains)).toEqual([
      ['reddit.com'],
      ['twitter.com', 'x.com'],
    ])
    expect((await harness.escalation.get(REDDIT_GROUP)).phase).toBe('active')
  })

  it('stale_redirects_from_a_previous_worker_are_replaced', async () => {
    const dnr = fakeDnr()
    await dnr.api.updateSessionRules({
      addRules: [
        {
          id: REDIRECT_RULE_FIRST_ID + 7,
          priority: 1,
          action: { type: 'allow' },
          condition: { resourceTypes: ['main_frame'] },
        },
      ],
    })
    const { sync } = redirects(gateHarness(), dnr)

    await sync.sync()

    expect(dnr.rules().map((rule) => rule.id)).toEqual([
      REDIRECT_RULE_FIRST_ID,
      REDIRECT_RULE_FIRST_ID + 1,
    ])
  })

  it('an_engine_error_keeps_the_last_installed_redirects', async () => {
    const harness = gateHarness()
    const dnr = fakeDnr()
    let failing = false
    const onEngineError = vi.fn()
    const sync = new GateRedirectRules({
      dnr: dnr.api,
      catalog: bundledRulesCatalog(),
      rulesets: { load: () => Promise.resolve(harness.state.ruleset) },
      decide: (url) =>
        failing ? Promise.resolve({ ...ENGINE_ERROR_DECISION }) : harness.decisions.decide(url),
      ticket: () => Promise.resolve(TICKET),
      runtimeId: 'test-extension',
      onEngineError,
    })
    await sync.sync()
    failing = true

    expect(await sync.sync()).toBe(false)

    expect(dnr.rules()).toHaveLength(2)
    expect(onEngineError).toHaveBeenCalledOnce()
  })

  it('an_engine_error_never_installs_a_redirect', async () => {
    const dnr = fakeDnr()
    const sync = new GateRedirectRules({
      dnr: dnr.api,
      catalog: bundledRulesCatalog(),
      rulesets: { load: () => Promise.resolve(gateHarness().state.ruleset) },
      decide: () => Promise.resolve({ ...ENGINE_ERROR_DECISION }),
      ticket: () => Promise.resolve(TICKET),
      runtimeId: 'test-extension',
    })

    await sync.sync()

    expect(dnr.rules()).toEqual([])
  })
})
