// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import type { Target } from '@monki-focus/rules'
import { canonicalTargetKey } from '../../src/CanonicalTarget.ts'
import { targetsOverlap } from '../../src/TargetOverlap.ts'
import { fixtureCatalog } from '../fixtures/FixtureCatalog.ts'

const site = (domain: string, path?: string): Target =>
  path === undefined ? { kind: 'site', domain } : { kind: 'site', domain, path }
const app = (pkg: string): Target => ({ kind: 'app', package: pkg })
const surface = (id: string): Target => ({ kind: 'surface', surface: id })

describe('TargetOverlap', () => {
  const overlap = (a: Target, b: Target): boolean => targetsOverlap(a, b, fixtureCatalog())

  it('apps_overlap_only_with_the_same_package', () => {
    expect(overlap(app('com.example.one'), app('com.example.one'))).toBe(true)
    expect(overlap(app('com.example.one'), app('com.example.two'))).toBe(false)
  })

  it('an_app_and_a_site_never_overlap', () => {
    expect(overlap(app('com.example.one'), site('example.org'))).toBe(false)
    expect(overlap(site('example.org'), app('com.example.one'))).toBe(false)
  })

  it('sites_overlap_when_one_domain_is_a_dot_suffix_of_the_other_paths_ignored', () => {
    expect(overlap(site('old.reddit.com', '/r/*'), site('www.reddit.com'))).toBe(true)
    expect(overlap(site('reddit.com'), site('notreddit.com'))).toBe(false)
  })

  it('surfaces_overlap_with_the_same_surface_any_app_and_their_profile_sites', () => {
    expect(overlap(surface('youtube.shorts'), surface('youtube.shorts'))).toBe(true)
    expect(overlap(surface('youtube.shorts'), surface('youtube.home'))).toBe(false)
    expect(overlap(app('com.example.one'), surface('youtube.shorts'))).toBe(true)
    expect(overlap(site('m.youtube.com'), surface('youtube.shorts'))).toBe(true)
    expect(overlap(surface('youtube.shorts'), site('reddit.com'))).toBe(false)
  })
})

describe('CanonicalTarget', () => {
  const key = (target: Target): string => canonicalTargetKey(target, fixtureCatalog())

  it('normalises_domains_and_globs_and_drops_the_catch_all', () => {
    expect(key(site('www.Twitter.com', '/**'))).toBe(key(site('x.com')))
    expect(key(site('reddit.com', '/R/*'))).toBe(key(site('reddit.com', '/r/*')))
  })

  it('keys_apps_and_surfaces_by_their_id', () => {
    expect(key(app('com.example.one'))).toBe('app:com.example.one')
    expect(key(surface('youtube.shorts'))).toBe('surface:youtube.shorts')
  })
})
