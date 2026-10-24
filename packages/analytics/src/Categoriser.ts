// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * `categorise(activity, assignments, includeDefaults)` of SEMANTICS.md §9:
 * assignments match like rule targets (§3, the engine's `matchesTarget`) and
 * the most specific wins by §4 steps 1–4 (the engine's `targetSpecificity`);
 * on a full tie a user assignment beats a default, then the lower level,
 * then list order. No match is neutral `uncategorised`. The defaults come
 * from the rules catalog (`data/categories/default.json`).
 */
import type { CategorisableActivity, CategoryAssignment, CategoryMatch } from '@monki-focus/rules'
import type { ResolvedObservation, RulesCatalog, TargetSpecificity } from '@monki-focus/engine'
import { compareTargetSpecificity, matchesTarget, targetSpecificity } from '@monki-focus/engine'

export const UNCATEGORISED: Readonly<CategoryMatch> = { level: 50, categoryPath: 'uncategorised' }

interface Candidate {
  assignment: CategoryAssignment
  fromUser: boolean
  order: number
  specificity: TargetSpecificity
}

/** The activity as a target-matching observation: a site for web time, an app otherwise. */
function observationOf(activity: CategorisableActivity): ResolvedObservation {
  if (activity.source !== 'web') {
    return { kind: 'app', package: activity.activityKey, surface: activity.surface }
  }
  return {
    kind: 'site',
    host: activity.activityKey,
    path: activity.path ?? '/',
    pathKnown: activity.path !== null,
    surface: activity.surface,
  }
}

/** Negative when `a` wins over `b`. */
function compareCandidates(a: Candidate, b: Candidate): number {
  return (
    compareTargetSpecificity(a.specificity, b.specificity) ||
    Number(b.fromUser) - Number(a.fromUser) ||
    a.assignment.level - b.assignment.level ||
    a.order - b.order
  )
}

export function categorise(
  activity: CategorisableActivity,
  assignments: readonly CategoryAssignment[],
  catalog: RulesCatalog,
  includeDefaults = true
): CategoryMatch {
  const observation = observationOf(activity)
  const defaults = includeDefaults ? catalog.defaultCategories : []
  const winner = [
    ...assignments.map((assignment) => ({ assignment, fromUser: true })),
    ...defaults.map((assignment) => ({ assignment, fromUser: false })),
  ]
    .map((entry, order) => ({
      ...entry,
      order,
      specificity: targetSpecificity(entry.assignment.target, catalog),
    }))
    .filter((candidate) => matchesTarget(candidate.assignment.target, observation, catalog))
    .sort(compareCandidates)[0]
  if (winner === undefined) return { ...UNCATEGORISED }
  return { level: winner.assignment.level, categoryPath: winner.assignment.category }
}
