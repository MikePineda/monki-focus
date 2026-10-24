// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { schemaValidator } from '../../src/index.ts'

function isValidTarget(target: unknown): boolean {
  return schemaValidator().validate('target', target).valid
}

describe('target schema', () => {
  it.each([['reddit.com'], ['old.reddit.com'], ['xn--bcher-kva.example'], ['example.xn--p1ai']])(
    'accepts_lower_case_punycode_domain %s',
    (domain) => {
      expect(isValidTarget({ kind: 'site', domain })).toBe(true)
    }
  )

  it.each([
    ['www.reddit.com', 'www prefix'],
    ['m.youtube.com', 'mobile prefix'],
    ['Reddit.com', 'upper case'],
    ['https://reddit.com', 'scheme'],
    ['reddit.com:443', 'port'],
    ['localhost', 'single label'],
    ['bücher.example', 'not punycode'],
  ])('rejects_domain %s (%s)', (domain) => {
    expect(isValidTarget({ kind: 'site', domain })).toBe(false)
  })

  it.each([
    ['/'],
    ['/**'],
    ['/r/MachineLearning'],
    ['/r/*/comments/**'],
    ['/watch'],
    ['/reels/**'],
  ])('accepts_path_glob %s', (path) => {
    expect(isValidTarget({ kind: 'site', domain: 'reddit.com', path })).toBe(true)
  })

  it.each([
    ['r/MachineLearning', 'no leading slash'],
    ['/r/Machine*', 'partial wildcard'],
    ['/**/comments', 'double star not last'],
    ['/r/(a|b)', 'regex syntax'],
    ['/r/.*', 'regex wildcard'],
    ['/r/', 'trailing slash'],
    ['/search?q=x', 'query'],
  ])('rejects_path_glob %s (%s)', (path) => {
    expect(isValidTarget({ kind: 'site', domain: 'reddit.com', path })).toBe(false)
  })

  it('app_target_takes_a_reverse_dns_package', () => {
    expect(isValidTarget({ kind: 'app', package: 'com.instagram.android' })).toBe(true)
    expect(isValidTarget({ kind: 'app', package: 'instagram' })).toBe(false)
  })

  it('surface_target_takes_a_family_dot_name_id', () => {
    expect(isValidTarget({ kind: 'surface', surface: 'youtube.shorts' })).toBe(true)
    expect(isValidTarget({ kind: 'surface', surface: 'Shorts' })).toBe(false)
  })

  it('target_kinds_cannot_mix_fields', () => {
    expect(isValidTarget({ kind: 'app', package: 'com.example.app', domain: 'example.com' })).toBe(
      false
    )
  })
})
