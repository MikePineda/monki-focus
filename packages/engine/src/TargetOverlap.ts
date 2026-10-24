// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Whether two **normalised** targets can match a common observation
 * (SEMANTICS.md §8, outrank check): the same package; sites whose domains are
 * equal or one is a dot-suffix of the other (paths ignored); the same surface;
 * a site and a surface of that site's profile; an app and any surface.
 */
import type { SiteTarget, Target } from '@monki-focus/rules'
import { isDomainOrSubdomain } from './DomainNormaliser.ts'
import type { RulesCatalog } from './RulesCatalog.ts'

function domainsOverlap(a: string, b: string): boolean {
  return isDomainOrSubdomain(a, b) || isDomainOrSubdomain(b, a)
}

function siteHasSurface(site: SiteTarget, surface: string, catalog: RulesCatalog): boolean {
  const domain = catalog.normaliseDomain(site.domain)
  return catalog.profiles.some(
    (profile) =>
      domainsOverlap(domain, profile.domain) &&
      profile.surfaces.some((entry) => entry.surface === surface)
  )
}

function surfaceOverlaps(surface: string, other: Target, catalog: RulesCatalog): boolean {
  switch (other.kind) {
    case 'surface':
      return other.surface === surface
    case 'app':
      return true
    case 'site':
      return siteHasSurface(other, surface, catalog)
  }
}

export function targetsOverlap(a: Target, b: Target, catalog: RulesCatalog): boolean {
  if (a.kind === 'surface') return surfaceOverlaps(a.surface, b, catalog)
  if (b.kind === 'surface') return surfaceOverlaps(b.surface, a, catalog)
  if (a.kind === 'app' || b.kind === 'app') {
    return a.kind === 'app' && b.kind === 'app' && a.package === b.package
  }
  return domainsOverlap(catalog.normaliseDomain(a.domain), catalog.normaliseDomain(b.domain))
}
