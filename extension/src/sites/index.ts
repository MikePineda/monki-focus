// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RulesCatalog } from '@monki-focus/engine'
import { instagram } from './instagram'
import { reddit } from './reddit'
import type { SiteFeedProfile } from './SiteFeedProfile'
import { x } from './x'
import { youtube } from './youtube'

/** Every site the feed guard knows, one per bundled site profile. */
export const SITE_FEED_PROFILES: readonly SiteFeedProfile[] = [reddit, x, youtube, instagram]

/**
 * The feed profile of the site that owns `host` (aliases and subdomains
 * resolved by the engine catalog: `twitter.com` -> `x.com`), or null.
 */
export function siteFeedProfileFor(
  host: string | null,
  catalog: RulesCatalog
): SiteFeedProfile | null {
  if (host === null) return null
  const domain = catalog.profileForHost(host)?.domain
  return SITE_FEED_PROFILES.find((site) => site.domain === domain) ?? null
}
