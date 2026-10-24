// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.AppObservation
import dev.monkifocus.android.core.domain.rules.NormalizedUrl
import dev.monkifocus.android.core.domain.rules.Observation
import dev.monkifocus.android.core.domain.rules.RejectedUrl
import dev.monkifocus.android.core.domain.rules.SiteObservation

/**
 * What `decide` matches targets against: a site observation after URL
 * normalisation (§2), an app observation as its detector reported it, or a
 * rejected URL that matches nothing (§5.1).
 */
internal sealed class ResolvedObservation {
    abstract val surface: String?

    data class Site(
        val host: String,
        val path: String,
        val pathKnown: Boolean,
        override val surface: String?,
    ) : ResolvedObservation()

    data class App(
        val packageName: String,
        override val surface: String?,
    ) : ResolvedObservation()

    data object Rejected : ResolvedObservation() {
        override val surface: String? = null
    }
}

internal fun resolveObservation(
    observation: Observation,
    catalog: RulesCatalog,
): ResolvedObservation =
    when (observation) {
        is AppObservation -> {
            ResolvedObservation.App(observation.packageName, observation.surface)
        }

        is SiteObservation -> {
            when (val normalized = normalizeUrl(observation.urlText, catalog)) {
                is RejectedUrl -> ResolvedObservation.Rejected
                is NormalizedUrl -> ResolvedObservation.Site(normalized.host, normalized.path, normalized.pathKnown, normalized.surface)
            }
        }
    }

/** A site observation whose path cannot be trusted (§5.5). */
internal fun hasUnknownPath(observation: ResolvedObservation): Boolean = observation is ResolvedObservation.Site && !observation.pathKnown
