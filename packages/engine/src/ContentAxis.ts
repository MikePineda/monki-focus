// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The content axis (SEMANTICS.md §5.3): `hide-feed` and `allow` candidates
 * compete (an allow rule speaks for both axes) and the most specific wins.
 * A `hide-feed` winner hides only a resolved `feed` surface; a permalink or a
 * utility surface, an unmapped path and an unknown path are always shown.
 */
import type { Content, Rule } from '@monki-focus/rules'
import type { ResolvedObservation } from './ResolvedObservation.ts'
import type { RulesCatalog } from './RulesCatalog.ts'
import { mostSpecific } from './Specificity.ts'

export type ContentReason =
  'rule_match' | 'permalink_never_hidden' | 'path_unknown_allow' | 'not_a_feed'

export interface ContentOutcome {
  content: Content
  /** The content winner, or null when no rule competes on this axis. */
  winner: Rule | null
  reason: ContentReason
}

function hideFeedOutcome(
  winner: Rule,
  observation: ResolvedObservation,
  catalog: RulesCatalog
): ContentOutcome {
  if (observation.kind === 'site' && !observation.pathKnown) {
    return { content: 'show', winner, reason: 'path_unknown_allow' }
  }
  const kind = observation.surface === null ? null : catalog.surfaceKind(observation.surface)
  if (kind === 'feed') return { content: 'hide-feed', winner, reason: 'rule_match' }
  if (kind === null) return { content: 'show', winner, reason: 'not_a_feed' }
  return { content: 'show', winner, reason: 'permalink_never_hidden' }
}

/** `matching` are the enabled, scheduled rules whose target matches the observation. */
export function contentOutcome(
  matching: readonly Rule[],
  observation: ResolvedObservation,
  catalog: RulesCatalog
): ContentOutcome {
  const winner = mostSpecific(
    matching.filter((rule) => rule.mode === 'hide-feed' || rule.mode === 'allow'),
    catalog
  )
  if (winner?.mode !== 'hide-feed') return { content: 'show', winner, reason: 'rule_match' }
  return hideFeedOutcome(winner, observation, catalog)
}
