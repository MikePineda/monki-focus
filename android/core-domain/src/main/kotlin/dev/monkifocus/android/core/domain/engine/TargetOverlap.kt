// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.AppTarget
import dev.monkifocus.android.core.domain.rules.SiteTarget
import dev.monkifocus.android.core.domain.rules.SurfaceTarget
import dev.monkifocus.android.core.domain.rules.Target

/*
 * Whether two **normalised** targets can match a common observation
 * (SEMANTICS.md §8, outrank check): the same package; sites whose domains are
 * equal or one is a dot-suffix of the other (paths ignored); the same surface;
 * a site and a surface of that site's profile; an app and any surface.
 */

private fun domainsOverlap(
    a: String,
    b: String,
): Boolean = isDomainOrSubdomain(a, b) || isDomainOrSubdomain(b, a)

private fun siteHasSurface(
    site: SiteTarget,
    surface: String,
    catalog: RulesCatalog,
): Boolean {
    val domain = catalog.normaliseDomain(site.domain)
    return catalog.profiles.any { profile -> domainsOverlap(domain, profile.domain) && profile.surfaces.any { it.surface == surface } }
}

private fun surfaceOverlaps(
    surface: String,
    other: Target,
    catalog: RulesCatalog,
): Boolean =
    when (other) {
        is SurfaceTarget -> other.surface == surface
        is AppTarget -> true
        is SiteTarget -> siteHasSurface(other, surface, catalog)
    }

internal fun targetsOverlap(
    a: Target,
    b: Target,
    catalog: RulesCatalog,
): Boolean =
    when {
        a is SurfaceTarget -> surfaceOverlaps(a.surface, b, catalog)
        b is SurfaceTarget -> surfaceOverlaps(b.surface, a, catalog)
        a is AppTarget || b is AppTarget -> a is AppTarget && b is AppTarget && a.packageName == b.packageName
        a is SiteTarget && b is SiteTarget -> domainsOverlap(catalog.normaliseDomain(a.domain), catalog.normaliseDomain(b.domain))
        else -> false
    }
