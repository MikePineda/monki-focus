// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The category level `decide` needs for bedtime (SEMANTICS.md §5.2.1, §9).
 * The full `categorise` (with category paths and activities) lives in
 * @monki-focus/analytics; this is the level-only view `decide` uses, always
 * with the default categories. Uncategorised is 50.
 *
 * - Known path: the most specific assignment by §4 steps 1–4; on a full tie a
 *   user assignment beats a default, then the lower level, then list order.
 * - Unknown path (§5.5): the minimum level over every assignment of the
 *   domain: site targets of the domain with any path and surface targets of
 *   its profile (`youtube.com` counts as 0 because of Shorts).
 */
import type { CategoryAssignment, CategoryLevel } from '@monki-focus/rules'
import type { ResolvedObservation } from './ResolvedObservation.ts'
import type { RulesCatalog } from './RulesCatalog.ts'
import { compareTargetSpecificity, targetSpecificity } from './Specificity.ts'
import { matchesHostOfUnknownPath, matchesTarget } from './TargetMatcher.ts'

export const UNCATEGORISED_LEVEL: CategoryLevel = 50

interface RankedAssignment {
  assignment: CategoryAssignment
  isUser: boolean
  order: number
}

function compareAssignments(
  a: RankedAssignment,
  b: RankedAssignment,
  catalog: RulesCatalog
): number {
  return (
    compareTargetSpecificity(
      targetSpecificity(a.assignment.target, catalog),
      targetSpecificity(b.assignment.target, catalog)
    ) ||
    Number(b.isUser) - Number(a.isUser) ||
    a.assignment.level - b.assignment.level ||
    a.order - b.order
  )
}

function rankedAssignments(
  userAssignments: readonly CategoryAssignment[],
  catalog: RulesCatalog
): RankedAssignment[] {
  const user = userAssignments.map((assignment) => ({ assignment, isUser: true }))
  const defaults = catalog.defaultCategories.map((assignment) => ({ assignment, isUser: false }))
  return [...user, ...defaults].map((entry, order) => ({ ...entry, order }))
}

export function categoryLevelOf(
  observation: ResolvedObservation,
  userAssignments: readonly CategoryAssignment[],
  catalog: RulesCatalog
): CategoryLevel {
  if (observation.kind === 'rejected') return UNCATEGORISED_LEVEL
  const ranked = rankedAssignments(userAssignments, catalog)
  if (observation.kind === 'site' && !observation.pathKnown) {
    const levels = ranked
      .filter(({ assignment }) =>
        matchesHostOfUnknownPath(assignment.target, observation.host, catalog)
      )
      .map(({ assignment }) => assignment.level)
    return levels.length === 0 ? UNCATEGORISED_LEVEL : (Math.min(...levels) as CategoryLevel)
  }
  const best = ranked
    .filter(({ assignment }) => matchesTarget(assignment.target, observation, catalog))
    .sort((a, b) => compareAssignments(a, b, catalog))[0]
  return best?.assignment.level ?? UNCATEGORISED_LEVEL
}
