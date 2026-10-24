// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FeedDecision } from '../shared/messages'
import { SHORTS_SURFACE, shortsWatchUrl } from '../sites/youtube'

/** The slice of `Location` the redirector uses. */
export interface ReplaceableLocation {
  readonly href: string
  replace(url: string): void
}

/**
 * The in-app half of the Shorts redirect: YouTube moves to `/shorts/<id>`
 * with `pushState`, which the DNR ruleset never sees, so after an SPA
 * navigation the feed guard replaces the page with its watch URL while the
 * rule set restricts the Shorts surface. Returns whether it redirected.
 */
export function redirectShorts(answer: FeedDecision, location: ReplaceableLocation): boolean {
  if (answer.surface !== SHORTS_SURFACE || !answer.restrict.includes(SHORTS_SURFACE)) return false
  const watchUrl = shortsWatchUrl(location.href)
  if (watchUrl === null) return false
  location.replace(watchUrl)
  return true
}
