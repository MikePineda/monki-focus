// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The access axis (SEMANTICS.md §5.1, §5.5): `allow`, `friction` and `block`
 * candidates compete and the most specific wins (§4). With an unknown path the
 * candidates are every rule of the host's domain and profile, each with an
 * **effective** mode (a `hide-feed` rule that can cover a feed surface and a
 * surface `block` count as `friction`), and the strictest effective mode wins,
 * ties by §4. Unknown paths therefore never fail open.
 */
import type { Rule } from '@monki-focus/rules'
import type { ResolvedObservation } from './ResolvedObservation.ts'
import type { RulesCatalog } from './RulesCatalog.ts'
import { compareRules } from './Specificity.ts'

export type AccessMode = 'allow' | 'friction' | 'block'

export interface AccessCandidate {
  rule: Rule
  mode: AccessMode
}

const ACCESS_STRICTNESS: Readonly<Record<AccessMode, number>> = {
  allow: 0,
  friction: 1,
  block: 2,
}

/** §5.5: the mode an unknown-path candidate competes with on the access axis, if any. */
function unknownPathMode(rule: Rule, host: string, catalog: RulesCatalog): AccessMode | null {
  const { target } = rule
  if (rule.mode === 'hide-feed') {
    const coversFeed =
      target.kind === 'surface'
        ? catalog.surfaceKind(target.surface) === 'feed'
        : (catalog
            .profileForHost(host)
            ?.surfaces.some(({ surface }) => catalog.surfaceKind(surface) === 'feed') ?? false)
    return coversFeed ? 'friction' : null
  }
  // Remove the feed, not the tool: a surface block gates; a site block stays a block.
  if (rule.mode === 'block' && target.kind === 'surface') return 'friction'
  return rule.mode
}

/**
 * Access candidates with their effective modes. `candidates` are the matching
 * rules (known path) or the unknown-path candidates of §5.5.
 */
export function accessCandidates(
  candidates: readonly Rule[],
  observation: ResolvedObservation,
  catalog: RulesCatalog
): AccessCandidate[] {
  if (observation.kind === 'site' && !observation.pathKnown) {
    const host = observation.host
    return candidates.flatMap((rule) => {
      const mode = unknownPathMode(rule, host, catalog)
      return mode === null ? [] : [{ rule, mode }]
    })
  }
  return candidates.flatMap((rule) =>
    rule.mode === 'hide-feed' ? [] : [{ rule, mode: rule.mode }]
  )
}

/** The access winner: most specific (§4), after the strictest effective mode on an unknown path. */
export function accessWinner(
  candidates: readonly AccessCandidate[],
  unknownPath: boolean,
  catalog: RulesCatalog
): AccessCandidate | null {
  const ranked = [...candidates].sort(
    (a, b) =>
      (unknownPath ? ACCESS_STRICTNESS[b.mode] - ACCESS_STRICTNESS[a.mode] : 0) ||
      compareRules(a.rule, b.rule, catalog)
  )
  return ranked[0] ?? null
}
