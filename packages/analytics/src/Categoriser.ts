// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * `categorise(activity, assignments, …)` of SEMANTICS.md §9: the most
 * specific matching assignment wins (§4 steps 1–4); on a full tie a user
 * assignment beats a default, then the lower level, then list order. No
 * match is neutral `uncategorised`.
 */
import type {
  CategorisableActivity,
  CategoryAssignment,
  CategoryMatch,
  SiteProfile,
  Target,
} from '@monki-focus/rules'
import { hostMatchesDomain, normaliseDomain } from './DomainNormaliser.ts'
import { matchesGlob } from './PathGlob.ts'
import type { Specificity } from './TargetSpecificity.ts'
import { compareSpecificity, specificityOf } from './TargetSpecificity.ts'

export const UNCATEGORISED: Readonly<CategoryMatch> = { level: 50, categoryPath: 'uncategorised' }

export interface CategoriseOptions {
  /** Factory assignments (`data/categories/default.json`) when they take part. */
  defaults?: readonly CategoryAssignment[]
  /** Site profiles, for alias rewriting of assignment domains. */
  siteProfiles?: readonly SiteProfile[]
}

interface Candidate {
  assignment: CategoryAssignment
  fromUser: boolean
  order: number
  specificity: Specificity
}

function matches(
  target: Target,
  activity: CategorisableActivity,
  siteProfiles: readonly SiteProfile[]
): boolean {
  switch (target.kind) {
    case 'app':
      return activity.source !== 'web' && target.package === activity.activityKey
    case 'surface':
      return activity.surface !== null && target.surface === activity.surface
    case 'site': {
      if (activity.source !== 'web') return false
      const host = normaliseDomain(activity.activityKey, siteProfiles)
      if (!hostMatchesDomain(host, normaliseDomain(target.domain, siteProfiles))) return false
      if (target.path === undefined || target.path === '/**') return true
      return activity.path !== null && matchesGlob(target.path, activity.path)
    }
  }
}

/** Negative when `a` wins over `b`. */
function compareCandidates(a: Candidate, b: Candidate): number {
  return (
    compareSpecificity(b.specificity, a.specificity) ||
    Number(b.fromUser) - Number(a.fromUser) ||
    a.assignment.level - b.assignment.level ||
    a.order - b.order
  )
}

export function categorise(
  activity: CategorisableActivity,
  assignments: readonly CategoryAssignment[],
  options: CategoriseOptions = {}
): CategoryMatch {
  const siteProfiles = options.siteProfiles ?? []
  const listed = [
    ...assignments.map((assignment) => ({ assignment, fromUser: true })),
    ...(options.defaults ?? []).map((assignment) => ({ assignment, fromUser: false })),
  ]
  const winner = listed
    .map((entry, order) => ({
      ...entry,
      order,
      specificity: specificityOf(entry.assignment.target, siteProfiles),
    }))
    .filter((candidate) => matches(candidate.assignment.target, activity, siteProfiles))
    .sort(compareCandidates)[0]
  if (winner === undefined) return { ...UNCATEGORISED }
  return { level: winner.assignment.level, categoryPath: winner.assignment.category }
}
