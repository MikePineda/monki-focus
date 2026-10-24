// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import {
  addSiteRule,
  allowedSubreddits,
  allowSubreddit,
  parseDomainInput,
  parseSubredditName,
  removeCategory,
  setDomainCategory,
} from '../../../src/options/rules/RulesetEdits'
import { pendingChanges, pendingRuleIds } from '../../../src/options/rules/PendingChanges'
import { validateRuleset } from '../../../src/shared/RulesetValidation'
import { makeRule, makeRuleset } from '../../factories/makeRuleset'

describe('RulesetEdits', () => {
  it.each([
    ['r/AskScience', 'AskScience'],
    ['/r/AskScience/', 'AskScience'],
    [' learnprogramming ', 'learnprogramming'],
    ['r/a', null],
    ['r/has space', null],
    ['r/../etc', null],
  ])('subreddit_input_%s_reads_as_%s', (input, expected) => {
    expect(parseSubredditName(input)).toBe(expected)
  })

  it.each([
    ['example.com', 'example.com'],
    ['https://www.Example.com/path?q=1', 'example.com'],
    ['sub.example.co.uk', 'sub.example.co.uk'],
    ['localhost', null],
    ['not a domain', null],
    ['', null],
  ])('domain_input_%s_reads_as_%s', (input, expected) => {
    expect(parseDomainInput(input)).toBe(expected)
  })

  it('an_allowed_subreddit_is_an_allow_rule_on_its_reddit_path', () => {
    const next = allowSubreddit(makeRuleset(), 'AskScience')

    expect(allowedSubreddits(next).map((entry) => entry.name)).toEqual(['AskScience'])
    expect(allowSubreddit(next, 'askscience')).toBe(next)
    expect(validateRuleset(next)).toEqual({ valid: true })
  })

  it('new_rule_ids_never_collide', () => {
    const once = addSiteRule(makeRuleset({ rules: [] }), 'video.example', 'block')
    const twice = addSiteRule(once, 'video.example', 'friction')

    expect(twice.rules.map((rule) => rule.id)).toEqual([
      'site-video-example',
      'site-video-example-2',
    ])
  })

  it('a_domain_level_replaces_the_previous_one_and_keeps_the_factory_category', () => {
    const first = setDomainCategory(makeRuleset(), 'reddit.com', 25)
    const second = setDomainCategory(first, 'www.reddit.com', 0)

    expect(second.categories).toEqual([
      { target: { kind: 'site', domain: 'www.reddit.com' }, level: 0, category: 'social' },
    ])
    expect(removeCategory(second, 0).categories).toEqual([])
    expect(validateRuleset(setDomainCategory(makeRuleset(), 'docs.example', 100))).toEqual({
      valid: true,
    })
  })
})

describe('pendingChanges', () => {
  it('names_every_part_that_still_waits', () => {
    const effective = makeRuleset()
    const configured = makeRuleset({
      rules: [
        makeRule({ dailyBudgetMinutes: 60 }),
        makeRule({ id: 'site-new', target: { kind: 'site', domain: 'new.example' } }),
      ],
      bedtime: { ...effective.bedtime, enabled: false },
      revision: 9,
    })

    const changes = pendingChanges(effective, configured)

    expect(changes.map((change) => change.kind)).toEqual(['rule_changed', 'rule_added', 'bedtime'])
    expect(pendingRuleIds(changes)).toEqual(new Set(['site-example', 'site-new']))
  })

  it('key_order_and_category_order_are_not_changes', () => {
    const effective = makeRuleset({
      categories: [
        { target: { kind: 'site', domain: 'a.example' }, level: 0, category: 'social' },
        { target: { kind: 'site', domain: 'b.example' }, level: 100, category: 'focus' },
      ],
    })
    const reordered = structuredClone(effective)
    reordered.categories.reverse()
    const [rule] = effective.rules
    if (!rule) throw new Error('needs a rule')
    reordered.rules = [
      {
        enabled: rule.enabled,
        schedules: [],
        mode: rule.mode,
        target: rule.target,
        id: rule.id,
        dailyBudgetMinutes: 30,
      },
    ]

    expect(pendingChanges(effective, reordered)).toEqual([])
  })
})
