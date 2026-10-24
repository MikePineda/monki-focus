// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RulesCatalog } from '@monki-focus/engine'
import { feedSurfacesOfHost, pageSurfaceOf } from '../shared/FeedSurfaces'
import type { HideState } from './FeedHider'

/**
 * What stays hidden until the service worker answers (and if it never
 * does): the page's own surface when the engine's catalog says it is a
 * `feed` of the site, plus the entry points of every feed of the site.
 * Permalinks and utility pages (search, messages) are never pre-hidden.
 */
export function failClosedHideState(url: string, catalog: RulesCatalog): HideState {
  const { host, surface } = pageSurfaceOf(url, catalog)
  const feeds = feedSurfacesOfHost(host, catalog)
  return {
    hide: surface !== null && feeds.includes(surface) ? [surface] : [],
    restrict: feeds,
  }
}
