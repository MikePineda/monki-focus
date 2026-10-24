// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.Serializable

/** `site-profile.schema.json`: URL path globs of one site mapped to surfaces (`data/sites/<domain>.json`). */
@Serializable
data class SiteProfile(
    val schemaVersion: Int,
    val domain: String,
    val aliases: List<String>,
    val spaNavigation: String,
    /** Surface id to the path globs that resolve to it. */
    val surfaces: Map<String, List<String>>,
)
