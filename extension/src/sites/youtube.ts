// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SiteFeedProfile } from './SiteFeedProfile'

/** Desktop `ytd-browse` marks which browse page it renders with `page-subtype`. */
const browse = (subtype: string, content: string) =>
  `ytd-browse[page-subtype="${subtype}"] ${content}`

/** The browse page of m.youtube.com (`ytm-*`), which carries no page subtype. */
const MOBILE_BROWSE = ['ytm-browse ytm-rich-grid-renderer', 'ytm-browse ytm-section-list-renderer']

/** The Shorts surface id (`packages/rules/data/surfaces.json`). */
export const SHORTS_SURFACE = 'youtube.shorts'

/** A Shorts video id, as the DNR ruleset captures it. */
const SHORTS_PATH = /^\/shorts\/([A-Za-z0-9_-]{11})(?:\/|$)/

/**
 * YouTube, desktop (`ytd-*`) and mobile (`ytm-*`): Polymer custom elements
 * with stable names and attributes.
 *
 * - Desktop browse pages are page containers (`page-subtype` says which
 *   surface they render), hidden on every page while the surface is
 *   restricted, so an in-app navigation never shows them in between.
 * - Mobile browse pages look alike for every surface, so they are hidden by
 *   URL only.
 * - Shorts shelves, the Shorts guide entry and the mobile pivot-bar Shorts
 *   tab are entry points: hidden on every page while Shorts are restricted.
 */
export const youtube: SiteFeedProfile = {
  domain: 'youtube.com',
  nameKey: 'site.youtube',
  hide: {
    'youtube.home': MOBILE_BROWSE,
    'youtube.subscriptions': MOBILE_BROWSE,
    'youtube.explore': MOBILE_BROWSE,
  },
  pageContainers: {
    'youtube.home': [browse('home', 'ytd-rich-grid-renderer')],
    'youtube.subscriptions': [browse('subscriptions', 'ytd-rich-grid-renderer')],
    'youtube.explore': [
      browse('trending', 'ytd-two-column-browse-results-renderer'),
      browse('explore', 'ytd-two-column-browse-results-renderer'),
      browse('hashtag-landing-page', 'ytd-two-column-browse-results-renderer'),
      browse('gaming', 'ytd-two-column-browse-results-renderer'),
    ],
    [SHORTS_SURFACE]: ['ytd-shorts'],
  },
  entryPoints: {
    [SHORTS_SURFACE]: [
      'ytd-reel-shelf-renderer',
      'ytd-rich-shelf-renderer[is-shorts]',
      'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])',
      'ytd-guide-entry-renderer:has(a[href^="/shorts"])',
      'ytd-mini-guide-entry-renderer:has(a[href^="/shorts"])',
      'ytm-reel-shelf-renderer',
      'ytm-rich-section-renderer:has(ytm-reel-shelf-renderer)',
      'ytm-shorts-lockup-view-model',
      'ytm-pivot-bar-item-renderer:has(.pivot-shorts)',
      'ytm-pivot-bar-item-renderer:has([href^="/shorts"])',
    ],
  },
  placeholder: [
    { kind: 'search', action: '/results', param: 'search_query' },
    { kind: 'link', href: '/feed/subscriptions', labelKey: 'feedPlaceholder.subscriptions' },
  ],
}

/**
 * The watch page of a Shorts URL (`/shorts/<id>` -> `/watch?v=<id>`), or
 * null when the path is not a Shorts video. Same target as the DNR ruleset.
 */
export function shortsWatchUrl(pageUrl: string): string | null {
  let path: string
  try {
    path = new URL(pageUrl).pathname
  } catch {
    return null
  }
  const id = SHORTS_PATH.exec(path)?.[1]
  return id ? `https://www.youtube.com/watch?v=${id}` : null
}
