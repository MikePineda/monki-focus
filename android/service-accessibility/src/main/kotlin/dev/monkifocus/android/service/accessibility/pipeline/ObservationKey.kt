// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.pipeline

/**
 * The identity of an observed target for [DecisionThrottle]: an app screen
 * (package + surface, and whether the unclassified cap applies) or a web
 * page (browser + [UrlKey]). Holds no raw URL and no node text.
 */
sealed interface ObservationKey {
    data class App(
        val packageName: String,
        val surface: String?,
        val capped: Boolean = false,
    ) : ObservationKey

    data class Site(
        val packageName: String,
        val url: UrlKey,
    ) : ObservationKey
}
