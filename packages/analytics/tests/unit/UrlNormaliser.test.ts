// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { normalizeUrl } from '../../src/index.ts'
import { makeSiteProfile } from '../factories/ActivityFactory.ts'

describe('UrlNormaliser', () => {
  it('a_host_url_cannot_parse_is_rejected', () => {
    expect(normalizeUrl('exa mple.org/page', [])).toStrictEqual({ rejected: 'invalid_host' })
  })

  it('a_single_label_host_is_rejected', () => {
    expect(normalizeUrl('http://intranet/page', [])).toStrictEqual({ rejected: 'invalid_host' })
  })

  it('a_host_with_a_port_and_no_scheme_reads_as_a_scheme', () => {
    expect(normalizeUrl('intranet:8080/page', [])).toStrictEqual({ rejected: 'not_http' })
  })

  it('a_profiled_site_with_no_matching_glob_has_no_surface', () => {
    const profiles = [makeSiteProfile('example.org', { 'example.feed': ['/feed'] })]
    expect(normalizeUrl('https://example.org/about', profiles)).toStrictEqual({
      host: 'example.org',
      path: '/about',
      pathKnown: true,
      surface: null,
    })
  })

  it('the_longest_matching_profile_domain_applies', () => {
    const profiles = [
      makeSiteProfile('example.org', { 'example.feed': ['/**'] }),
      makeSiteProfile('old.example.org', { 'legacy.feed': ['/**'] }),
    ]
    expect(normalizeUrl('https://old.example.org/x', profiles)).toMatchObject({
      surface: 'legacy.feed',
    })
  })

  it('equal_globs_resolve_to_the_lowest_surface_id', () => {
    const profiles = [
      makeSiteProfile('example.org', { 'example.zeta': ['/page'], 'example.alpha': ['/page'] }),
    ]
    expect(normalizeUrl('https://example.org/page', profiles)).toMatchObject({
      surface: 'example.alpha',
    })
  })

  it('fewer_wildcards_win_between_globs_with_equal_literals', () => {
    const profiles = [
      makeSiteProfile('example.org', {
        'example.alpha': ['/a/*/**'],
        'example.beta': ['/a/*'],
      }),
    ]
    expect(normalizeUrl('https://example.org/a/b', profiles)).toMatchObject({
      surface: 'example.beta',
    })
  })

  it('an_alias_subdomain_is_rewritten_to_the_canonical_domain', () => {
    const profiles = [makeSiteProfile('example.org', {}, ['example.net'])]
    expect(normalizeUrl('https://news.example.net/', profiles)).toMatchObject({
      host: 'news.example.org',
    })
  })

  it('a_stray_percent_sign_is_kept_as_written', () => {
    expect(normalizeUrl('https://example.org/50%25/%zz', [])).toMatchObject({
      path: '/50%25/%zz',
      pathKnown: true,
    })
  })
})
