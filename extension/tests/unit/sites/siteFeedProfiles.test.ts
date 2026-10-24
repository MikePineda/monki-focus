// SPDX-License-Identifier: AGPL-3.0-or-later
import { siteProfiles, surfaceRegistry } from '@monki-focus/rules/pure'
import { describe, expect, it } from 'vitest'
import en from '../../../src/i18n/catalogs/en.json'
import { bundledRulesCatalog } from '../../../src/shared/bundledRulesCatalog'
import { SITE_FEED_PROFILES, siteFeedProfileFor } from '../../../src/sites'

const surfaceIds = new Set(surfaceRegistry.surfaces.map((surface) => surface.id))
const HASHED_CLASS = /\.[a-zA-Z_-]*[0-9][a-zA-Z0-9_-]{4,}/

describe.each(SITE_FEED_PROFILES.map((site) => [site.domain, site] as const))(
  'site feed profile %s',
  (domain, site) => {
    const profile = siteProfiles.find((candidate) => candidate.domain === domain)
    const maps = [site.hide, site.pageContainers, site.entryPoints]
    const keys = maps.flatMap((map) => Object.keys(map))

    it('belongs_to_a_bundled_site_profile', () => {
      expect(profile).toBeDefined()
    })

    it('every_selector_map_key_is_a_real_surface_id', () => {
      for (const key of keys) expect(surfaceIds, key).toContain(key)
    })

    it('every_selector_map_key_is_a_surface_of_its_own_site', () => {
      const own = Object.keys(profile?.surfaces ?? {})
      for (const key of keys) expect(own, key).toContain(key)
    })

    it('only_feed_surfaces_are_ever_hidden', () => {
      for (const key of keys) {
        expect(surfaceRegistry.surfaces.find((surface) => surface.id === key)?.kind, key).toBe(
          'feed'
        )
      }
    })

    it('selectors_are_valid_css_and_never_hashed_class_names', () => {
      const selectors = maps.flatMap((map) => Object.values(map)).flat()
      expect(selectors.length).toBeGreaterThan(0)
      for (const selector of selectors) {
        expect(
          () => document.createDocumentFragment().querySelector(selector),
          selector
        ).not.toThrow()
        expect(selector, selector).not.toMatch(HASHED_CLASS)
      }
    })

    it('placeholder_copy_comes_from_the_catalog', () => {
      const keysUsed = [
        site.nameKey,
        ...site.placeholder.flatMap((part) => ('labelKey' in part ? [part.labelKey] : [])),
      ]
      for (const key of keysUsed) expect(Object.keys(en), key).toContain(key)
    })

    it('placeholder_links_stay_on_the_site', () => {
      for (const part of site.placeholder) {
        if (part.kind === 'link') expect(part.href).toMatch(/^\/[^/]/)
        if (part.kind === 'search') expect(part.action).toMatch(/^\/[^/]?/)
      }
    })
  }
)

describe('siteFeedProfileFor', () => {
  const catalog = bundledRulesCatalog()

  it.each([
    ['reddit.com', 'reddit.com'],
    ['old.reddit.com', 'reddit.com'],
    ['x.com', 'x.com'],
    ['mobile.x.com', 'x.com'],
    ['youtube.com', 'youtube.com'],
    ['instagram.com', 'instagram.com'],
  ])('host_%s_uses_the_%s_profile', (host, domain) => {
    expect(siteFeedProfileFor(host, catalog)?.domain).toBe(domain)
  })

  it('a_host_without_a_profile_has_no_feed_profile', () => {
    expect(siteFeedProfileFor('news.example', catalog)).toBeNull()
    expect(siteFeedProfileFor(null, catalog)).toBeNull()
  })

  it('every_bundled_site_profile_has_a_feed_profile', () => {
    expect(SITE_FEED_PROFILES.map((site) => site.domain).sort()).toEqual(
      siteProfiles.map((profile) => profile.domain).sort()
    )
  })
})

describe('X For you detection', () => {
  const [forYou] = SITE_FEED_PROFILES.find((site) => site.domain === 'x.com')?.hide['x.home'] ?? []

  it('needs_position_and_link_to_agree_before_showing_a_timeline', () => {
    // Shown only for a selected tab that is not the first one and links to
    // a chosen timeline; anything else hides it (fail closed).
    expect(forYou).toContain(':not(:has(')
    expect(forYou).toContain(':not(:first-child)')
    expect(forYou).toContain('[href="/home"]')
    expect(forYou).toContain('[href^="/i/lists/"]')
    expect(forYou).not.toMatch(/For you|Following/)
  })
})

describe('YouTube on desktop and mobile', () => {
  const site = SITE_FEED_PROFILES.find((candidate) => candidate.domain === 'youtube.com')

  it.each(['youtube.home', 'youtube.subscriptions', 'youtube.explore'])(
    '%s_has_ytd_page_containers_and_ytm_page_content',
    (surface) => {
      expect(site?.pageContainers[surface]?.join(' ')).toContain('ytd-')
      expect(site?.hide[surface]?.join(' ')).toContain('ytm-')
    }
  )

  it('shorts_entry_points_cover_both_sites', () => {
    const entries = site?.entryPoints['youtube.shorts']?.join(' ') ?? ''
    expect(entries).toContain('ytd-reel-shelf-renderer')
    expect(entries).toContain('ytm-reel-shelf-renderer')
    expect(entries).toContain('ytm-pivot-bar-item-renderer')
  })
})
