// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Browser tab sampling (SEMANTICS.md §10.2). The adapter reads the browser
 * state; this function decides whether it is a heartbeat and what it holds.
 * The URL goes through the engine's `normalizeUrl` (§2): never the query or
 * the fragment; the title only when the user opted in.
 */
import type { ActivityEvent, TabProbeGiven, WebTabData } from '@monki-focus/rules'
import type { RulesCatalog } from '@monki-focus/engine'
import { epochSecondsOf, normalizeUrl, utcInstantOf } from '@monki-focus/engine'

export type TabProbeInput = TabProbeGiven

/** A zero-length heartbeat at `now`, or `null` when nothing must be counted. */
export function probeTab(input: TabProbeInput, catalog: RulesCatalog): ActivityEvent | null {
  const { tab, settings } = input
  if (!input.windowFocused || input.idleState === 'locked' || tab === null) return null
  const countsWhileIdle = tab.audible && settings.countAudibleWhileIdle
  if (input.idleState === 'idle' && !countsWhileIdle) return null

  const url = normalizeUrl(tab.url, catalog)
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
