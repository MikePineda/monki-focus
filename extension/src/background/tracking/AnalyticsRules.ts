// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CategoryAssignment } from '@monki-focus/analytics'
import { isResolvableTimeZone } from '../rules/DeviceTimeZone'
import type { RulesetStore } from '../rules/RulesetStore'

/** What analytics needs from the rule set. */
export interface AnalyticsRules {
  /** The pinned zone local days are counted in. */
  timeZone: string
  /** The user's category overrides (the bundled defaults apply on top). */
  categories: CategoryAssignment[]
}

const LEVELS: readonly number[] = [0, 25, 50, 75, 100]

function isAssignment(value: unknown): value is CategoryAssignment {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<CategoryAssignment>
  return (
    typeof candidate.target === 'object' &&
    candidate.target !== null &&
    typeof candidate.category === 'string' &&
    typeof candidate.level === 'number' &&
    LEVELS.includes(candidate.level)
  )
}

/**
 * The rule set's pinned `timeZone` and `categories`, read through
 * `RulesetStore` (the single owner of the active rule set, which creates the
 * starter set on first read). The store hands back whatever is stored, so an
 * unresolvable zone falls back to `fallbackTimeZone` and malformed category
 * entries are skipped: stats degrade, they never throw.
 */
export async function readAnalyticsRules(
  rulesets: Pick<RulesetStore, 'load'>,
  fallbackTimeZone: string
): Promise<AnalyticsRules> {
  const ruleset = (await rulesets.load()) as { timeZone?: unknown; categories?: unknown }
  const timeZone = isResolvableTimeZone(ruleset.timeZone) ? ruleset.timeZone : fallbackTimeZone
  const categories = Array.isArray(ruleset.categories)
    ? ruleset.categories.filter(isAssignment)
    : []
  return { timeZone, categories }
}
