// SPDX-License-Identifier: AGPL-3.0-or-later
import { starterPreset, type Ruleset } from '@monki-focus/rules/pure'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { RULESET_KEY, RulesetStore } from '../../../../src/background/rules/RulesetStore'
import { readAnalyticsRules } from '../../../../src/background/tracking/AnalyticsRules'

const SITE = { kind: 'site', domain: 'news.example' } as const

function store(deviceZone = 'Etc/GMT-3') {
  return new RulesetStore({ storage: fakeBrowser.storage.local, deviceTimeZone: () => deviceZone })
}

async function storeRuleset(overrides: Record<string, unknown>): Promise<void> {
  await fakeBrowser.storage.local.set({ [RULESET_KEY]: { ...starterPreset, ...overrides } })
}

describe('analytics rules', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('a_fresh_install_counts_days_in_the_zone_pinned_into_the_starter_rule_set', async () => {
    const rules = await readAnalyticsRules(store('Etc/GMT-3'), 'UTC')

    expect(rules.timeZone).toBe('Etc/GMT-3')
    expect(rules.categories).toEqual(starterPreset.categories)
  })

  it('the_rule_sets_pinned_zone_and_categories_are_used', async () => {
    const categories: Ruleset['categories'] = [{ target: SITE, level: 25, category: 'news' }]
    await storeRuleset({ timeZone: 'Australia/Sydney', categories })

    expect(await readAnalyticsRules(store(), 'UTC')).toEqual({
      timeZone: 'Australia/Sydney',
      categories,
    })
  })

  it('an_unresolvable_zone_and_malformed_categories_are_ignored', async () => {
    await storeRuleset({
      timeZone: 'Nowhere/Invented',
      categories: [
        { target: SITE, level: 30, category: 'news' },
        { target: null, level: 0, category: 'news' },
        'news.example',
        { target: SITE, level: 0, category: 'social' },
      ],
    })

    expect(await readAnalyticsRules(store(), 'UTC')).toEqual({
      timeZone: 'UTC',
      categories: [{ target: SITE, level: 0, category: 'social' }],
    })
  })
})
