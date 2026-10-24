// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Category changes (SEMANTICS.md §8), by normalised target: tightening iff
 * present in both with a level that is lower or equal (more distracting
 * reaches bedtime sooner); an added, removed or raised assignment waits.
 * Returns what applies today: `new`'s list with every waiting assignment
 * replaced by its old version (added ones left out, removed ones kept at the
 * end in their old order).
 */
import type { CategoryAssignment } from '@monki-focus/rules'
import { canonicalTargetKey } from './CanonicalTarget.ts'
import type { RulesCatalog } from './RulesCatalog.ts'

export interface CategoryPlan {
  categoriesToday: CategoryAssignment[]
  waits: boolean
}

export function planCategories(
  previous: readonly CategoryAssignment[],
  next: readonly CategoryAssignment[],
  catalog: RulesCatalog
): CategoryPlan {
  const keyOf = (assignment: CategoryAssignment): string =>
    canonicalTargetKey(assignment.target, catalog)
  const previousByKey = new Map(previous.map((assignment) => [keyOf(assignment), assignment]))
  const nextKeys = new Set(next.map(keyOf))
  const judged = next.map((assignment) => {
    const before = previousByKey.get(keyOf(assignment))
    if (before === undefined) return { today: [], waits: true }
    return assignment.level <= before.level
      ? { today: [assignment], waits: false }
      : { today: [before], waits: true }
  })
  const removed = previous.filter((assignment) => !nextKeys.has(keyOf(assignment)))
  return {
    categoriesToday: [...judged.flatMap(({ today }) => today), ...removed],
    waits: removed.length > 0 || judged.some(({ waits }) => waits),
  }
}
