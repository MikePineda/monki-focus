// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { createRulesCatalog, normalizeUrl } from '../../src/index.ts'
import { fixtureCatalog } from '../fixtures/FixtureCatalog.ts'

/** A synthetic catalog: two aliases of one site and two equally specific globs. */
const syntheticCatalog = createRulesCatalog({
  siteProfiles: [
    {
      schemaVersion: 1,
      domain: 'video.example',
      aliases: ['vod.example', 'vid.example', 'old.vid.example'],
      spaNavigation: 'history',
      surfaces: {
        'video.b_feed': ['/watch/*'],
        'video.a_feed': ['/*/clip'],
        'video.empty': undefined,
      },
    },
  ],
  surfaces: [
    { id: 'video.a_feed', family: 'video', kind: 'feed' },
    { id: 'video.b_feed', family: 'video', kind: 'feed' },
  ],
  defaultCategories: [],
})

describe('UrlNormalizer', () => {
  it('rejects_a_host_with_an_empty_label', () => {
    expect(normalizeUrl('https://a..example/x', fixtureCatalog())).toEqual({
      rejected: 'invalid_host',
    })
  })

  it('rejects_text_the_whatwg_parser_refuses', () => {
    expect(normalizeUrl('https://exa mple.org/', fixtureCatalog())).toEqual({
      rejected: 'invalid_host',
    })
  })

  it('rejects_a_single_label_host_such_as_localhost', () => {
    expect(normalizeUrl('http://localhost:3000/', fixtureCatalog())).toEqual({
      rejected: 'invalid_host',
    })
  })

  it('treats_a_dotted_prefix_before_a_colon_as_a_host_not_a_scheme', () => {
    expect(normalizeUrl('news.example.org:8080/today', fixtureCatalog())).toEqual({
      host: 'news.example.org',
      path: '/today',
      pathKnown: true,
      surface: null,
    })
  })

  it('equally_specific_globs_resolve_to_the_smallest_surface_id', () => {
    expect(normalizeUrl('https://video.example/watch/clip', syntheticCatalog)).toMatchObject({
      surface: 'video.a_feed',
    })
  })

  it('the_longest_alias_suffix_is_rewritten_first', () => {
    expect(normalizeUrl('https://www.old.vid.example/watch/x', syntheticCatalog)).toMatchObject({
      host: 'video.example',
      surface: 'video.b_feed',
    })
    expect(normalizeUrl('https://m.vid.example/', syntheticCatalog)).toMatchObject({
      host: 'video.example',
      surface: null,
    })
  })

  it('a_dot_segment_hidden_in_an_escape_makes_the_path_unknown', () => {
    expect(normalizeUrl('https://reddit.com/r/%2E%2Ex', fixtureCatalog())).toMatchObject({
      pathKnown: true,
    })
    expect(normalizeUrl('https://reddit.com/r/x%2Fy', fixtureCatalog())).toMatchObject({
      path: '/r/x%2Fy',
      pathKnown: false,
      surface: null,
    })
  })
})

describe('RulesCatalog', () => {
  it('an_unregistered_surface_has_no_kind', () => {
    expect(syntheticCatalog.surfaceKind('video.unknown')).toBeNull()
    expect(syntheticCatalog.surfaceKind('video.a_feed')).toBe('feed')
  })

  it('a_host_without_a_profile_has_none', () => {
    expect(syntheticCatalog.profileForHost('news.example.org')).toBeNull()
  })
})
