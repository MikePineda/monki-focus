// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RulesCatalog } from '@monki-focus/engine'
import { pageSurfaceOf } from '../../shared/FeedSurfaces'

/** Stands in for a `*` segment when a glob is turned into a concrete path. */
const WILDCARD_SEGMENT = 'monkifocusprobe'

function concretePathOf(glob: string): string {
  const segments = glob
    .split('/')
    .filter((segment) => segment !== '' && segment !== '**')
    .map((segment) => (segment === '*' ? WILDCARD_SEGMENT : segment))
  return `/${segments.join('/')}`
}

/**
 * A URL that the engine resolves to `surface`, built from the surface's own
 * globs in the bundled site profile (never a path list of the extension), or
 * null when no glob yields one. The service worker decides on it to learn
 * whether the rule set restricts a surface without a page of it being open:
 * the Shorts redirect and the entry points hidden on every page of a site.
 */
export function probeUrlFor(surface: string, catalog: RulesCatalog): string | null {
  for (const profile of catalog.profiles) {
    const entry = profile.surfaces.find((candidate) => candidate.surface === surface)
    if (!entry) continue
    for (const glob of entry.globs) {
      const url = `https://${profile.domain}${concretePathOf(glob)}`
      if (pageSurfaceOf(url, catalog).surface === surface) return url
    }
  }
  return null
}
