// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Steps 1–4 of the specificity order (SEMANTICS.md §4) for a target. A site
 * path without literal segments (`/**`, `/*`, `/*\/**`) ranks as no path.
 */
import type { SiteProfile, Target } from '@monki-focus/rules'
import { normaliseDomain } from './DomainNormaliser.ts'
import { literalSegmentCount, wildcardCount } from './PathGlob.ts'

export interface Specificity {
  /** Step 1: a surface, or a site path with a literal segment. */
  refinement: 0 | 1
  /** Step 2: literal path segments. */
  literals: number
  /** Step 3: labels of the normalised domain. */
  labels: number
  /** Step 4: wildcards (fewer wins). */
  wildcards: number
}

export function specificityOf(target: Target, siteProfiles: readonly SiteProfile[]): Specificity {
  switch (target.kind) {
    case 'app':
      return { refinement: 0, literals: 0, labels: 0, wildcards: 0 }
    case 'surface':
      return { refinement: 1, literals: 0, labels: 0, wildcards: 0 }
    case 'site': {
      const labels = normaliseDomain(target.domain, siteProfiles).split('.').length
      const literals = target.path === undefined ? 0 : literalSegmentCount(target.path)
      if (target.path === undefined || literals === 0) {
        return { refinement: 0, literals: 0, labels, wildcards: 0 }
      }
      return { refinement: 1, literals, labels, wildcards: wildcardCount(target.path) }
    }
  }
}

/** Positive when `a` is more specific than `b`, negative when less, 0 on a tie. */
export function compareSpecificity(a: Specificity, b: Specificity): number {
  return (
    a.refinement - b.refinement ||
    a.literals - b.literals ||
    a.labels - b.labels ||
    b.wildcards - a.wildcards
  )
}
