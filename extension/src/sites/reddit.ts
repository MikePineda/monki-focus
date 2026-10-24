// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SiteFeedProfile } from './SiteFeedProfile'

/**
 * Reddit: the new UI renders every listing in the `shreddit-feed` custom
 * element; old Reddit lists posts in `#siteTable`. A permalink keeps its post
 * and comments (no `shreddit-feed` there, and the engine never hides it).
 */
export const reddit: SiteFeedProfile = {
  domain: 'reddit.com',
  nameKey: 'site.reddit',
  hide: {
    'reddit.feed': ['shreddit-feed', '#siteTable'],
    'reddit.user_feed': ['shreddit-feed', '#siteTable'],
  },
  pageContainers: {},
  entryPoints: {},
  placeholder: [{ kind: 'search', action: '/search/', param: 'q' }, { kind: 'communities' }],
}
