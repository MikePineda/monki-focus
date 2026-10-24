// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Browser tab sampling (SEMANTICS.md §10.2). The adapter reads the browser
 * state; this function decides whether it is a heartbeat and what it holds.
 * Never the query or the fragment; the title only when the user opted in.
 */
import type { ActivityEvent, SiteProfile, TabProbeGiven, WebTabData } from '@monki-focus/rules'
import { epochSecondsOf, utcInstantOf } from './Instant.ts'
import { normalizeUrl } from './UrlNormaliser.ts'

export type TabProbeInput = TabProbeGiven

/** A zero-length heartbeat at `now`, or `null` when nothing must be counted. */
export function probeTab(
  input: TabProbeInput,
  siteProfiles: readonly SiteProfile[]
): ActivityEvent | null {
  const { tab, settings } = input
  if (!input.windowFocused || input.idleState === 'locked' || tab === null) return null
  const countsWhileIdle = tab.audible && settings.countAudibleWhileIdle
  if (input.idleState === 'idle' && !countsWhileIdle) return null

  const url = normalizeUrl(tab.url, siteProfiles)
  if ('rejected' in url) return null
  const data: WebTabData = {
    domain: url.host,
    path: url.path,
    surface: url.surface,
    audible: tab.audible,
    incognito: tab.incognito,
  }
  if (settings.storeTitles && tab.title !== undefined) data.title = tab.title
  return { timestamp: utcInstantOf(epochSecondsOf(input.now)), duration: 0, data }
}
