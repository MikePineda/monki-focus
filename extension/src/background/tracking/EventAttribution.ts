// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  categorise,
  type ActivityEvent,
  type AttributedEvent,
  type CategoryAssignment,
} from '@monki-focus/analytics'
import type { RulesCatalog } from '@monki-focus/engine'

/**
 * A web event as an attributed event: the domain is the activity key and the
 * category comes from the user's assignments over the bundled defaults
 * (SEMANTICS.md §9). Incognito events only carry a domain, so their path is
 * unknown to `categorise`. The title and URL are never copied. Non-web
 * events answer `null`.
 */
export function attributeEvent(
  event: ActivityEvent,
  categories: readonly CategoryAssignment[],
  catalog: RulesCatalog
): AttributedEvent | null {
  if (!('domain' in event.data)) return null
  const { domain, path, surface, incognito } = event.data
  const match = categorise(
    { source: 'web', activityKey: domain, path: incognito ? null : path, surface },
    categories,
    catalog
  )
  return {
    timestamp: event.timestamp,
    duration: event.duration,
    source: 'web',
    activityKey: domain,
    categoryPath: match.categoryPath,
    level: match.level,
  }
}
