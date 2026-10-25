// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.pipeline

import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.engine.normalizeUrl
import dev.monkifocus.android.core.domain.rules.NormalizedUrl
import dev.monkifocus.android.core.domain.rules.RejectedUrl

/**
 * What the service keeps of a URL bar reading (docs/threat-model.md B4,
 * "URL → host + first segment in memory"): the normalised host, the first
 * path segment and the surface the engine resolves for the full path. The
 * raw text is cut down to this immediately after it is read; only the one
 * `decide` call of the same event sees the full text. Never persisted.
 */
data class UrlKey(
    val host: String,
    val firstSegment: String?,
    val pathKnown: Boolean,
    val surface: String?,
) {
    companion object {
        /** The key of [urlText], or [REJECTED] when it is not an http(s) URL with a valid host. */
        fun of(
            urlText: String,
            catalog: RulesCatalog,
        ): UrlKey =
            when (val normalized = normalizeUrl(urlText, catalog)) {
                is RejectedUrl -> {
                    REJECTED
                }

                is NormalizedUrl -> {
                    UrlKey(
                        host = normalized.host,
                        firstSegment =
                            normalized.path
                                .removePrefix("/")
                                .substringBefore('/')
                                .takeIf { it.isNotEmpty() },
                        pathKnown = normalized.pathKnown,
                        surface = normalized.surface,
                    )
                }
            }

        /** Search terms, `chrome://` pages, placeholders: nothing a rule can name. */
        val REJECTED = UrlKey(host = "", firstSegment = null, pathKnown = false, surface = null)
    }
}
