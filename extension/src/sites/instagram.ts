// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SiteFeedProfile } from './SiteFeedProfile'

const MAIN = 'main[role="main"]'

/**
 * Instagram ships hashed class names only, so its surfaces are the page's
 * `main` landmark (hidden only while the page itself is that surface) and
 * the nav links by their exact href. Direct and search stay untouched: the
 * engine never hides utility surfaces.
 */
export const instagram: SiteFeedProfile = {
  domain: 'instagram.com',
  nameKey: 'site.instagram',
  hide: {
    'instagram.home': [MAIN],
    'instagram.reels': [MAIN],
    'instagram.explore': [MAIN],
  },
  entryPoints: {
    'instagram.reels': ['a[href="/reels/"]'],
    'instagram.explore': ['a[href="/explore/"]'],
  },
  placeholder: [
    { kind: 'link', href: '/direct/inbox/', labelKey: 'feedPlaceholder.direct' },
    { kind: 'link', href: '/explore/search/', labelKey: 'feedPlaceholder.search' },
  ],
}
