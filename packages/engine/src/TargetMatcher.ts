// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Target matching (SEMANTICS.md §3.1). Domains are normalised like hosts
 * first. A site target without a path, or with `/**`, matches every path,
 * also an unknown one; any other glob must match the observed path and never
 * matches an unknown path. A surface target matches any observation whose
 * resolved surface equals it, on the web and in an app alike.
 */
import type { Target } from '@monki-focus/rules'
import { isDomainOrSubdomain } from './DomainNormaliser.ts'
import { CATCH_ALL_GLOB, matchesGlob } from './PathGlob.ts'
import type { ResolvedObservation } from './ResolvedObservation.ts'
import type { RulesCatalog } from './RulesCatalog.ts'

export function matchesTarget(
  target: Target,
  observation: ResolvedObservation,
  catalog: RulesCatalog
): boolean {
  switch (target.kind) {
    case 'app':
      return observation.kind === 'app' && observation.package === target.package
    case 'surface':
      return observation.surface === target.surface
    case 'site': {
      if (observation.kind !== 'site') return false
      if (!isDomainOrSubdomain(observation.host, catalog.normaliseDomain(target.domain))) {
        return false
      }
      if (target.path === undefined || target.path === CATCH_ALL_GLOB) return true
      return observation.pathKnown && matchesGlob(target.path, observation.path)
    }
  }
}

/**
 * The unknown-path match of §5.5: a site target whose domain matches the
 * host (any path), or a surface target of the host's site profile.
 */
export function matchesHostOfUnknownPath(
  target: Target,
  host: string,
  catalog: RulesCatalog
): boolean {
  switch (target.kind) {
    case 'app':
      return false
    case 'site':
      return isDomainOrSubdomain(host, catalog.normaliseDomain(target.domain))
    case 'surface':
      return (
        catalog.profileForHost(host)?.surfaces.some(({ surface }) => surface === target.surface) ??
        false
      )
  }
}
