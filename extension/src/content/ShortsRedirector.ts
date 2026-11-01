// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FeedDecision } from '../shared/messages'
import { FACEBOOK_REELS_SURFACE, reelWatchUrl } from '../sites/facebook'
import { SHORTS_SURFACE, shortsWatchUrl } from '../sites/youtube'

/** The slice of `Location` the redirector uses. */
export interface ReplaceableLocation {
  readonly href: string
  replace(url: string): void
}

/** Short-video surfaces and the single-video page of one of their URLs (same targets as the DNR rulesets). */
const SINGLE_VIDEO_PAGES: Readonly<Record<string, (pageUrl: string) => string | null>> = {
  [SHORTS_SURFACE]: shortsWatchUrl,
  [FACEBOOK_REELS_SURFACE]: reelWatchUrl,
}

/**
 * The in-app half of the short-video redirects: YouTube moves to
 * `/shorts/<id>` and Facebook to `/reel/<id>` with `pushState`, which the DNR
 * rulesets never see, so after an SPA navigation the feed guard replaces the
 * page with its single-video page while the rule set restricts that surface.
 * Returns whether it redirected.
 */
export function redirectShorts(answer: FeedDecision, location: ReplaceableLocation): boolean {
  const surface = answer.surface
  if (surface === null || !answer.restrict.includes(surface)) return false
  const singleVideoPage = SINGLE_VIDEO_PAGES[surface]
  if (!singleVideoPage) return false
  const watchUrl = singleVideoPage(location.href)
  if (watchUrl === null) return false
  location.replace(watchUrl)
  return true
}
