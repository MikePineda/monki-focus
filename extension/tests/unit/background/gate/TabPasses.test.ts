// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import type { GateDnrRule } from '../../../../src/background/gate/GateRedirectRules'
import {
  PASS_LIFETIME_MS,
  PASS_RULE_FIRST_ID,
  TabPasses,
} from '../../../../src/background/gate/TabPasses'

function fakeDnr() {
  let rules: GateDnrRule[] = []
  return {
    getSessionRules: vi.fn(() => Promise.resolve(rules)),
    updateSessionRules: vi.fn((options: { removeRuleIds?: number[]; addRules?: GateDnrRule[] }) => {
      rules = rules.filter((rule) => !(options.removeRuleIds ?? []).includes(rule.id))
      rules.push(...(options.addRules ?? []))
      return Promise.resolve()
    }),
    rules: () => rules,
  }
}

describe('TabPasses', () => {
  let now: number
  beforeEach(() => {
    fakeBrowser.reset()
    now = Date.parse('2026-01-05T09:00:00Z')
  })

  it('a_pass_lets_exactly_that_url_load_in_exactly_that_tab', async () => {
    const dnr = fakeDnr()
    const passes = new TabPasses(dnr, fakeBrowser.storage.session, () => now)

    await passes.grant(7, 'https://www.reddit.com/r/a.b/?q=1')

    expect(dnr.rules()).toEqual([
      {
        id: PASS_RULE_FIRST_ID,
        priority: 2,
        action: { type: 'allow' },
        condition: {
          tabIds: [7],
          regexFilter: '^https://www\\.reddit\\.com/r/a\\.b/\\?q=1$',
          resourceTypes: ['main_frame'],
        },
      },
    ])
  })

  it('a_new_pass_for_a_tab_replaces_its_old_one_and_tabs_get_their_own', async () => {
    const dnr = fakeDnr()
    const passes = new TabPasses(dnr, fakeBrowser.storage.session, () => now)

    await passes.grant(7, 'https://www.reddit.com/a')
    await passes.grant(8, 'https://www.reddit.com/b')
    await passes.grant(7, 'https://www.reddit.com/c')

    expect(dnr.rules().map((rule) => [rule.id, rule.condition.tabIds])).toEqual([
      [PASS_RULE_FIRST_ID + 1, [8]],
      [PASS_RULE_FIRST_ID, [7]],
    ])
  })

  it('a_spent_pass_is_revoked', async () => {
    const dnr = fakeDnr()
    const passes = new TabPasses(dnr, fakeBrowser.storage.session, () => now)
    await passes.grant(7, 'https://www.reddit.com/a')

    await passes.revoke(7)

    expect(dnr.rules()).toEqual([])
  })

  it('an_unused_pass_expires', async () => {
    const dnr = fakeDnr()
    const passes = new TabPasses(dnr, fakeBrowser.storage.session, () => now)
    await passes.grant(7, 'https://www.reddit.com/a')
    now += PASS_LIFETIME_MS + 1

    await passes.grant(8, 'https://www.reddit.com/b')

    expect(dnr.rules().map((rule) => rule.condition.tabIds)).toEqual([[8]])
  })
})
