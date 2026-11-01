// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SiteFeedProfile } from './SiteFeedProfile'

/** The Reels surface id (`packages/rules/data/surfaces.json`). */
export const FACEBOOK_REELS_SURFACE = 'facebook.reels'

/** The Watch / Video tab surface id. */
export const FACEBOOK_WATCH_SURFACE = 'facebook.watch'

/** A reel id (digits only), as the DNR ruleset captures it. */
const REEL_PATH = /^\/reel\/([0-9]+)(?:\/|$)/

/** The page's `main` landmark: Facebook ships hashed class names only. */
const MAIN = '[role="main"]'

/** Links to the Watch / Video tab itself, never to a single video (`/watch/?v=`). */
const WATCH_TAB_LINKS = [
  'a[href="/watch/"]',
  'a[href="/watch"]',
  'a[href="/watch/?ref=tab"]',
  'a[href="https://www.facebook.com/watch/"]',
  'a[href="https://www.facebook.com/watch/?ref=tab"]',
]

/** Links to the Reels tab or to a single reel. */
const REEL_LINKS = [
  'a[href="/reel/"]',
  'a[href="/reels/"]',
  'a[href^="/reel/"]',
  'a[href^="https://www.facebook.com/reel/"]',
  'a[href^="https://m.facebook.com/reel/"]',
]

/**
 * Facebook, desktop and m.facebook.com. Class names are hashed, so the
 * selectors use ARIA roles and exact hrefs only (unverified against live
 * markup: confirm in the live smoke).
 *
 * - Watch / Video tab: only the feed list of the main landmark is hidden, so a
 *   shared `/watch/?v=<id>` video (same surface once the query is dropped)
 *   keeps its player while the suggestions go.
 * - Reels: the hard `/reel/<id>` load is redirected to the single-video
 *   player by DNR; reel shelves and carousels in any feed (a feed unit that
 *   links a reel), the Reels nav entry and reel links are entry points,
 *   hidden on every page while Reels are restricted.
 * - Home, Marketplace, groups, events, search and messages are never touched.
 */
export const facebook: SiteFeedProfile = {
  domain: 'facebook.com',
  nameKey: 'site.facebook',
  hide: {
    [FACEBOOK_WATCH_SURFACE]: [`${MAIN} [role="feed"]`],
  },
  pageContainers: {},
  entryPoints: {
    [FACEBOOK_REELS_SURFACE]: [
      ...REEL_LINKS,
      ...REEL_LINKS.map((link) => `[role="feed"] > div:has(${link})`),
      ...REEL_LINKS.map((link) => `[role="article"]:has(${link})`),
    ],
    [FACEBOOK_WATCH_SURFACE]: WATCH_TAB_LINKS,
  },
  placeholder: [
    { kind: 'search', action: '/search/top', param: 'q' },
    { kind: 'link', href: '/marketplace/', labelKey: 'feedPlaceholder.marketplace' },
  ],
}

/**
 * The single-video page of a reel (`/reel/<id>` -> `/watch/?v=<id>`), or
 * null when the path is not a reel. Same target as the DNR ruleset.
 */
export function reelWatchUrl(pageUrl: string): string | null {
  let path: string
  try {
    path = new URL(pageUrl).pathname
  } catch {
    return null
  }
  const id = REEL_PATH.exec(path)?.[1]
  return id ? `https://www.facebook.com/watch/?v=${id}` : null
}
