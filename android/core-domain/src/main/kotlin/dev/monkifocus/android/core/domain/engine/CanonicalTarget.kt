// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.AppTarget
import dev.monkifocus.android.core.domain.rules.SiteTarget
import dev.monkifocus.android.core.domain.rules.SurfaceTarget
import dev.monkifocus.android.core.domain.rules.Target

/**
 * The identity of a target after §3.1 normalisation, as the validator's
 * `x-uniqueBy` compares it (SEMANTICS.md §1): normalised domain, lower-cased
 * glob (globs compare case-insensitively) and the catch-all glob as no path. Two targets
 * with the same key are the same target.
 */
internal fun canonicalTargetKey(
    target: Target,
    catalog: RulesCatalog,
): String =
    when (target) {
        is AppTarget -> {
            "app:${target.packageName}"
        }

        is SurfaceTarget -> {
            "surface:${target.surface}"
        }

        is SiteTarget -> {
            val path = if (target.path == null || target.path == CATCH_ALL_GLOB) "" else target.path.lowercase()
            "site:${catalog.normaliseDomain(target.domain)}$path"
        }
    }
