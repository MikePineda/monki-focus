// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { extensionManifest, STATIC_RULESETS } from '../../../config/extensionManifest'

interface RedirectRule {
  id: number
  priority: number
  action: { type: string; redirect: { regexSubstitution: string } }
  condition: { regexFilter: string; resourceTypes: string[] }
}

const rules = JSON.parse(
  readFileSync(new URL('../../../public/rules/shorts-redirect.json', import.meta.url), 'utf8')
) as RedirectRule[]

/**
 * What DNR does with `regexSubstitution`: the first match in the URL is
 * replaced by the pattern (`\N` is capture group N) and any text outside the
 * match survives, so each filter must consume the whole URL.
 */
function redirectOf(url: string): string | null {
  for (const rule of rules) {
    const match = new RegExp(rule.condition.regexFilter).exec(url)
    if (!match) continue
    const substitution = rule.action.redirect.regexSubstitution.replace(
      /\\(\d)/g,
      (_, n: string) => match[Number(n)] ?? ''
    )
    return url.slice(0, match.index) + substitution + url.slice(match.index + match[0].length)
  }
  return null
}

describe('shorts-redirect static ruleset', () => {
  it('is_declared_in_the_manifest_and_enabled_by_default', () => {
    expect(extensionManifest({ mode: 'production' }).declarative_net_request).toEqual({
      rule_resources: [
        { id: 'shorts-redirect', enabled: true, path: 'rules/shorts-redirect.json' },
        {
          id: 'facebook-reels-redirect',
          enabled: true,
          path: 'rules/facebook-reels-redirect.json',
        },
      ],
    })
    expect(STATIC_RULESETS).toHaveLength(2)
  })

  it('redirects_only_top_level_navigations', () => {
    for (const rule of rules) {
      expect(rule.action.type).toBe('redirect')
      expect(rule.condition.resourceTypes).toEqual(['main_frame'])
    }
    expect(new Set(rules.map((rule) => rule.id)).size).toBe(rules.length)
  })

  it('every_filter_is_anchored_at_the_scheme_and_captures_an_eleven_character_id', () => {
    for (const rule of rules) {
      expect(rule.condition.regexFilter).toMatch(/^\^https:\/\//)
      expect(rule.condition.regexFilter).toContain('/shorts/([A-Za-z0-9_-]{11})')
    }
  })

  it('filters_avoid_optional_tails_over_the_dnr_regex_memory_limit', () => {
    // Chromium refuses a counted id followed by an optional or alternated
    // tail ("exceeded the 2KB memory limit when compiled"), so the end of
    // the id is spelled out as three rules: end of URL, `/...` and `?...`.
    for (const rule of rules) expect(rule.condition.regexFilter).not.toMatch(/\)\?\$?$|\|\$\)/)
  })

  it.each([
    ['https://www.youtube.com/shorts/abcdefghijk', 'abcdefghijk'],
    ['https://youtube.com/shorts/abc_DEF-123', 'abc_DEF-123'],
    ['https://m.youtube.com/shorts/abcdefghijk?feature=share', 'abcdefghijk'],
    ['https://www.youtube.com/shorts/abcdefghijk/?si=AbC%20d', 'abcdefghijk'],
    ['https://www.youtube.com/shorts/abcdefghijk/', 'abcdefghijk'],
  ])('%s_goes_to_the_watch_page', (url, id) => {
    expect(redirectOf(url)).toBe(`https://www.youtube.com/watch?v=${id}`)
  })

  it.each([
    'http://www.youtube.com/shorts/abcdefghijk',
    'https://www.youtube.com/shorts/abcdefghij',
    'https://www.youtube.com/shorts/abcdefghijkl',
    'https://www.youtube.com/shorts/abcdefghijk-',
    'https://www.youtube.com.evil.example/shorts/abcdefghijk',
    'https://evil.example/https://www.youtube.com/shorts/abcdefghijk',
    'https://music.youtube.com/shorts/abcdefghijk',
    'https://www.youtube.com/watch?v=abcdefghijk',
  ])('%s_is_left_alone', (url) => {
    expect(redirectOf(url)).toBeNull()
  })
})

describe('facebook-reels-redirect static ruleset', () => {
  const reelRules = JSON.parse(
    readFileSync(
      new URL('../../../public/rules/facebook-reels-redirect.json', import.meta.url),
      'utf8'
    )
  ) as RedirectRule[]

  function reelRedirectOf(url: string): string | null {
    for (const rule of reelRules) {
      const match = new RegExp(rule.condition.regexFilter).exec(url)
      if (!match) continue
      const substitution = rule.action.redirect.regexSubstitution.replace(
        /\\(\d)/g,
        (_, n: string) => match[Number(n)] ?? ''
      )
      return url.slice(0, match.index) + substitution + url.slice(match.index + match[0].length)
    }
    return null
  }

  it('is_declared_in_the_manifest_and_enabled_by_default', () => {
    expect(STATIC_RULESETS).toContainEqual({
      id: 'facebook-reels-redirect',
      enabled: true,
      path: 'rules/facebook-reels-redirect.json',
    })
  })

  it('redirects_only_top_level_navigations_from_the_scheme', () => {
    for (const rule of reelRules) {
      expect(rule.action.type).toBe('redirect')
      expect(rule.condition.resourceTypes).toEqual(['main_frame'])
      expect(rule.condition.regexFilter).toMatch(/^\^https:\/\//)
    }
    expect(new Set(reelRules.map((rule) => rule.id)).size).toBe(reelRules.length)
  })

  it.each([
    ['https://www.facebook.com/reel/1234567890123456', '1234567890123456'],
    ['https://facebook.com/reel/123456/', '123456'],
    ['https://m.facebook.com/reel/123456?s=ifu', '123456'],
    ['https://web.facebook.com/reel/123456/?s=ifu&fs=e', '123456'],
  ])('%s_goes_to_the_single_video_page', (url, id) => {
    expect(reelRedirectOf(url)).toBe(`https://www.facebook.com/watch/?v=${id}`)
  })

  it.each([
    'http://www.facebook.com/reel/123456',
    'https://www.facebook.com/reel/',
    'https://www.facebook.com/reels/',
    'https://www.facebook.com/reel/abc',
    'https://www.facebook.com.evil.example/reel/123456',
    'https://evil.example/https://www.facebook.com/reel/123456',
    'https://www.facebook.com/watch/?v=123456',
    'https://www.facebook.com/marketplace/',
  ])('%s_is_left_alone', (url) => {
    expect(reelRedirectOf(url)).toBeNull()
  })
})
