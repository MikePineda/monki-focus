// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Web surface resolution (SEMANTICS.md §2 step 8): the site profile whose
 * domain is the host or a dot-suffix of it, then, among its globs matching
 * the path, the most literal segments, the fewest wildcards and the lowest
 * surface id win.
 */
import type { PathGlob, SiteProfile } from '@monki-focus/rules'
import { compareCodeUnits } from './CodeUnitOrder.ts'
import { hostMatchesDomain } from './DomainNormaliser.ts'
import { literalSegmentCount, matchesGlob, wildcardCount } from './PathGlob.ts'

interface SurfaceCandidate {
  surface: string
  literals: number
  wildcards: number
}

function outranks(a: SurfaceCandidate, b: SurfaceCandidate): boolean {
  if (a.literals !== b.literals) return a.literals > b.literals
  if (a.wildcards !== b.wildcards) return a.wildcards < b.wildcards
  return compareCodeUnits(a.surface, b.surface) < 0
}

export function resolveSurface(
  host: string,
  path: string,
  siteProfiles: readonly SiteProfile[]
): string | null {
  // With nested profiles (`old.example.com` inside `example.com`) the longest domain applies.
  const profile = siteProfiles
    .filter((candidate) => hostMatchesDomain(host, candidate.domain))
    .sort((a, b) => b.domain.length - a.domain.length)[0]
  if (profile === undefined) return null
  let best: SurfaceCandidate | null = null
  // The schema gives every surface at least one glob (`minItems: 1`).
  const surfaces = Object.entries(profile.surfaces) as [string, PathGlob[]][]
  for (const [surface, globs] of surfaces) {
    for (const glob of globs) {
      if (!matchesGlob(glob, path)) continue
      const candidate = {
        surface,
        literals: literalSegmentCount(glob),
        wildcards: wildcardCount(glob),
      }
      if (best === null || outranks(candidate, best)) best = candidate
    }
  }
  return best?.surface ?? null
}
