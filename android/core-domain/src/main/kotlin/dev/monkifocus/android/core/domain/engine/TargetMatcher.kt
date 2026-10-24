// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.AppTarget
import dev.monkifocus.android.core.domain.rules.SiteTarget
import dev.monkifocus.android.core.domain.rules.SurfaceTarget
import dev.monkifocus.android.core.domain.rules.Target

/*
 * Target matching (SEMANTICS.md §3.1). Domains are normalised like hosts
 * first. A site target without a path, or with the catch-all glob, matches every path,
 * also an unknown one; any other glob must match the observed path and never
 * matches an unknown path. A surface target matches any observation whose
 * resolved surface equals it, on the web and in an app alike.
 */

internal fun matchesTarget(
    target: Target,
    observation: ResolvedObservation,
    catalog: RulesCatalog,
): Boolean =
    when (target) {
        is AppTarget -> {
            observation is ResolvedObservation.App && observation.packageName == target.packageName
        }

        is SurfaceTarget -> {
            observation.surface == target.surface
        }

        is SiteTarget -> {
            when {
                observation !is ResolvedObservation.Site -> false
                !isDomainOrSubdomain(observation.host, catalog.normaliseDomain(target.domain)) -> false
                target.path == null || target.path == CATCH_ALL_GLOB -> true
                else -> observation.pathKnown && matchesGlob(target.path, observation.path)
            }
        }
    }

/**
 * The unknown-path match of §5.5: a site target whose domain matches the
 * host (any path), or a surface target of the host's site profile.
 */
internal fun matchesHostOfUnknownPath(
    target: Target,
    host: String,
    catalog: RulesCatalog,
): Boolean =
    when (target) {
        is AppTarget -> false
        is SiteTarget -> isDomainOrSubdomain(host, catalog.normaliseDomain(target.domain))
        is SurfaceTarget -> catalog.profileForHost(host)?.surfaces?.any { it.surface == target.surface } ?: false
    }
