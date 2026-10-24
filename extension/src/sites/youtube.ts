// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SiteFeedProfile } from './SiteFeedProfile'

/** `ytd-browse` marks which browse page it renders with `page-subtype`. */
const browse = (subtype: string, content: string) =>
  `ytd-browse[page-subtype="${subtype}"] ${content}`

/** The Shorts surface id (`packages/rules/data/surfaces.json`). */
export const SHORTS_SURFACE = 'youtube.shorts'

/** A Shorts video id, as the DNR ruleset captures it. */
const SHORTS_PATH = /^\/shorts\/([A-Za-z0-9_-]{11})(?:\/|$)/

/**
 * YouTube: Polymer custom elements (`ytd-*`) with stable names and
 * attributes. Shorts shelves and the Shorts guide entry are entry points:
 * hidden on every page while Shorts are restricted.
 */
export const youtube: SiteFeedProfile = {
  domain: 'youtube.com',
  nameKey: 'site.youtube',
  hide: {
    'youtube.home': [browse('home', 'ytd-rich-grid-renderer')],
    'youtube.subscriptions': [browse('subscriptions', 'ytd-rich-grid-renderer')],
    'youtube.explore': [
      browse('trending', 'ytd-two-column-browse-results-renderer'),
      browse('explore', 'ytd-two-column-browse-results-renderer'),
      browse('hashtag-landing-page', 'ytd-two-column-browse-results-renderer'),
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
