// SPDX-License-Identifier: AGPL-3.0-or-later
import { normalizeUrl, type RulesCatalog } from '@monki-focus/engine'

/** Where a page URL sits in the site profiles, as the engine normalises it. */
export interface PageSurface {
  /** Normalised host (`reddit.com`), or null when the URL was rejected. */
  host: string | null
  /** The resolved surface id, or null (unknown path, no glob matched). */
  surface: string | null
}

export function pageSurfaceOf(url: string, catalog: RulesCatalog): PageSurface {
  const normalized = normalizeUrl(url, catalog)
  if ('rejected' in normalized) return { host: null, surface: null }
  return { host: normalized.host, surface: normalized.surface }
}

/**
 * The `feed` surfaces of the site profile that owns `host`, in profile order
 * (surface id ascending). Empty for a host without a profile.
 */
export function feedSurfacesOfHost(host: string | null, catalog: RulesCatalog): string[] {
  if (host === null) return []
  const profile = catalog.profileForHost(host)
  if (profile === null) return []
  return profile.surfaces
    .map(({ surface }) => surface)
    .filter((surface) => catalog.surfaceKind(surface) === 'feed')
}
