// SPDX-License-Identifier: AGPL-3.0-or-later
import { surfaceRegistry } from '@monki-focus/rules/pure'
import { describe, expect, it } from 'vitest'
import { probeUrlFor } from '../../../../src/background/decisions/SurfaceProbe'
import { bundledRulesCatalog } from '../../../../src/shared/bundledRulesCatalog'
import { pageSurfaceOf } from '../../../../src/shared/FeedSurfaces'

const catalog = bundledRulesCatalog()
const webFeeds = surfaceRegistry.surfaces.filter(
  (surface) =>
    surface.kind === 'feed' &&
    catalog.profiles.some((profile) => profile.surfaces.some((s) => s.surface === surface.id))
)

describe('probeUrlFor', () => {
  it.each(webFeeds.map((surface) => surface.id))(
    'probe_url_of_%s_resolves_back_to_it',
    (surface) => {
      const url = probeUrlFor(surface, catalog)

      expect(url).not.toBeNull()
      expect(pageSurfaceOf(url as string, catalog).surface).toBe(surface)
    }
  )

  it('shorts_probe_is_built_from_the_profile_glob', () => {
    expect(probeUrlFor('youtube.shorts', catalog)).toBe('https://youtube.com/shorts')
  })

  it('a_surface_no_profile_lists_has_no_probe', () => {
    expect(probeUrlFor('instagram.reel_from_dm', catalog)).toBeNull()
    expect(probeUrlFor('nowhere.feed', catalog)).toBeNull()
  })
})
