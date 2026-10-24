// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SiteFeedProfile } from './SiteFeedProfile'

const PRIMARY_COLUMN = '[data-testid="primaryColumn"]'
const HOME_TABS = '[role="tablist"] [role="presentation"]'
const TIMELINE = 'section[role="region"]'

/**
 * A selected home tab that is a chosen timeline, never "For you". Two
 * signals must agree, neither of them the tab's text: its position (not the
 * first tab) and its link (`/home` for Following, `/i/lists/<id>` for a
 * pinned list).
 */
const CHOSEN_TIMELINE_TAB = `${HOME_TABS}:not(:first-child) [role="tab"][aria-selected="true"]:is([href="/home"], [href^="/i/lists/"])`

/**
 * X (and twitter.com): the timeline is the `section[role="region"]` of the
 * primary column. On the home page it stays visible only while a chosen
 * timeline (Following, a pinned list) is selected; "For you", and any tab
 * layout the two signals cannot place, hides it (fail closed).
 */
export const x: SiteFeedProfile = {
  domain: 'x.com',
  nameKey: 'site.x',
  hide: {
    'x.home': [`${PRIMARY_COLUMN}:not(:has(${CHOSEN_TIMELINE_TAB})) ${TIMELINE}`],
    'x.explore': [`${PRIMARY_COLUMN} ${TIMELINE}`],
  },
  pageContainers: {},
  entryPoints: {
    'x.explore': ['a[data-testid="AppTabBar_Explore_Link"]'],
  },
  placeholder: [
    {
      kind: 'tab',
      selector: `${PRIMARY_COLUMN} ${HOME_TABS}:nth-child(2) [role="tab"][href="/home"]`,
      labelKey: 'feedPlaceholder.following',
    },
    { kind: 'search', action: '/search', param: 'q' },
  ],
}
