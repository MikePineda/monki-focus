// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * What `decide` matches targets against: a site observation after URL
 * normalisation (§2), an app observation as its detector reported it, or a
 * rejected URL that matches nothing (§5.1).
 */
import type { Observation } from '@monki-focus/rules'
import type { RulesCatalog } from './RulesCatalog.ts'
import { normalizeUrl } from './UrlNormalizer.ts'

export type ResolvedObservation =
  | { kind: 'site'; host: string; path: string; pathKnown: boolean; surface: string | null }
  | { kind: 'app'; package: string; surface: string | null }
  | { kind: 'rejected'; surface: null }

export function resolveObservation(
  observation: Observation,
  catalog: RulesCatalog
): ResolvedObservation {
  if (observation.kind === 'app') {
    return { kind: 'app', package: observation.package, surface: observation.surface }
  }
  const normalized = normalizeUrl(observation.urlText, catalog)
  return 'rejected' in normalized
    ? { kind: 'rejected', surface: null }
    : { kind: 'site', ...normalized }
}

/** A site observation whose path cannot be trusted (§5.5). */
export function hasUnknownPath(observation: ResolvedObservation): boolean {
  return observation.kind === 'site' && !observation.pathKnown
}
