// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RejectionCode, Ruleset, UtcInstant } from '@monki-focus/rules/pure'

/**
 * Rule set editing through the engine's rule-change policy (SEMANTICS.md §8,
 * `effectiveRuleSet`). The service worker owns both halves:
 *
 * - `rules.ruleset` (RulesetStore): the set that applies **now**, read by
 *   every decision. A change that only tightens lands here at once.
 * - `rules.pending`: the whole proposed set while any part of it loosens,
 *   with the instant it takes full effect. It replaces any earlier pending
 *   change and never moves an `effectiveFrom` earlier; cancelling it simply
 *   drops it, so nothing ever gets looser sooner.
 */
export interface PendingRuleChange {
  ruleset: Ruleset
  /** UTC instant (`…Z`) from which `ruleset` applies in full. */
  effectiveFrom: UtcInstant
}

export interface RulesState {
  /** What decisions use right now. */
  effective: Ruleset
  pending: PendingRuleChange | null
}

/** The set the user configured: the pending one while it waits, else the effective one. */
export function configuredRuleset(state: RulesState): Ruleset {
  return state.pending?.ruleset ?? state.effective
}

/**
 * Why a proposal was refused. `stale_revision`: another page saved first;
 * reload. `too_many_rules` / `invalid_ruleset`: the set that would apply
 * today (old waiting parts plus new tightening ones) does not validate.
 */
export type RuleChangeRejection =
  RejectionCode | 'stale_revision' | 'too_many_rules' | 'invalid_ruleset'

export type RuleChangeOutcome =
  | { status: 'applied'; state: RulesState }
  | { status: 'pending'; effectiveFrom: UtcInstant; state: RulesState }
  | { status: 'rejected'; code: RuleChangeRejection }

export interface RuleChangeProposal {
  ruleset: Ruleset
  /** `revision` of the configured set the page edited (optimistic lock). */
  baseRevision: number
}
