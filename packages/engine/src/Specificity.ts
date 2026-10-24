// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Specificity (SEMANTICS.md §4). Among candidates on one axis the most
 * specific wins; the first difference decides: refinement, literal path
 * segments, domain labels, wildcards (fewer wins), stricter mode, rule id
 * (code-unit ascending). A glob without literal segments counts as no path.
 */
import type { Rule, RuleMode, Target } from '@monki-focus/rules'
import { domainLabelCount } from './DomainNormaliser.ts'
import { globShape } from './PathGlob.ts'
import type { RulesCatalog } from './RulesCatalog.ts'

/** Steps 1–4 of §4 for a target (also used for category assignments, §9). */
export interface TargetSpecificity {
  refinement: 0 | 1
  literals: number
  labels: number
  wildcards: number
}

/** `block > friction > hide-feed > allow` (step 5). */
const MODE_STRICTNESS: Readonly<Record<RuleMode, number>> = {
  'allow': 0,
  'hide-feed': 1,
  'friction': 2,
  'block': 3,
}

export function modeStrictness(mode: RuleMode): number {
  return MODE_STRICTNESS[mode]
}

export function targetSpecificity(target: Target, catalog: RulesCatalog): TargetSpecificity {
  switch (target.kind) {
    case 'app':
      return { refinement: 0, literals: 0, labels: 0, wildcards: 0 }
    case 'surface':
      return { refinement: 1, literals: 0, labels: 0, wildcards: 0 }
    case 'site': {
      const labels = domainLabelCount(catalog.normaliseDomain(target.domain))
      const shape = globShape(target.path ?? '/')
      return shape.literals === 0
        ? { refinement: 0, literals: 0, labels, wildcards: 0 }
        : { refinement: 1, literals: shape.literals, labels, wildcards: shape.wildcards }
    }
  }
}

/** Negative when `a` is more specific than `b` by steps 1–4, positive when less, 0 on a tie. */
export function compareTargetSpecificity(a: TargetSpecificity, b: TargetSpecificity): number {
  return (
    b.refinement - a.refinement ||
    b.literals - a.literals ||
    b.labels - a.labels ||
    a.wildcards - b.wildcards
  )
}

/**
 * Full §4 order: negative when rule `a` outranks rule `b`. Step 5 always uses
 * the rule's own mode, also where §5.5 promotes it to an effective `friction`
 * (`decision.domain_only_youtube_is_not_allowed_by_default`).
 */
export function compareRules(a: Rule, b: Rule, catalog: RulesCatalog): number {
  return (
    compareTargetSpecificity(
      targetSpecificity(a.target, catalog),
      targetSpecificity(b.target, catalog)
    ) ||
    modeStrictness(b.mode) - modeStrictness(a.mode) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
}

/** "R outranks Q". */
export function outranks(r: Rule, q: Rule, catalog: RulesCatalog): boolean {
  return compareRules(r, q, catalog) < 0
}

/** The most specific rule of a non-empty list, or null for an empty one. */
export function mostSpecific(rules: readonly Rule[], catalog: RulesCatalog): Rule | null {
  return rules.reduce<Rule | null>(
    (best, rule) => (best === null || compareRules(rule, best, catalog) < 0 ? rule : best),
    null
  )
}
