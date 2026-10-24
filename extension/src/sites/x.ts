// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SiteFeedProfile } from './SiteFeedProfile'

const PRIMARY_COLUMN = '[data-testid="primaryColumn"]'
/** The home tabs; "For you" is the first one whatever the UI language. */
const HOME_TABS = '[role="tablist"] [role="presentation"]'

/**
 * X (and twitter.com): the timeline is the `section[role="region"]` of the
 * primary column. On the home page only the "For you" tab is the feed; it
 * is recognised by position (first tab selected), never by its text, so
 * "Following" stays readable.
 */
export const x: SiteFeedProfile = {
  domain: 'x.com',
  nameKey: 'site.x',
  hide: {
    'x.home': [
      `${PRIMARY_COLUMN}:has(${HOME_TABS}:first-child [aria-selected="true"]) section[role="region"]`,
    ],
    'x.explore': [`${PRIMARY_COLUMN} section[role="region"]`],
  },
  entryPoints: {
    'x.explore': ['a[data-testid="AppTabBar_Explore_Link"]'],
  },
  placeholder: [
    {
      kind: 'tab',
      selector: `${PRIMARY_COLUMN} ${HOME_TABS}:nth-child(2) [role="tab"]`,
      labelKey: 'feedPlaceholder.following',
    },
    { kind: 'search', action: '/search', param: 'q' },
  ],
}
