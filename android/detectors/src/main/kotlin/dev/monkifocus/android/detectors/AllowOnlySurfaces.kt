// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * Surfaces whose only purpose is to let something through (a reel a friend
 * sent, a story, the inbox), compiled into the app. Misclassifying a feed as
 * one of them opens the feed, so they get extra care:
 *
 * - on a truncated screen read they never match ([SurfaceClassifier]);
 * - every detector of one must carry the compiled positive evidence below
 *   in its `all` list ([PackInvariants]), so a pack cannot redefine them as
 *   "anything on screen".
 */
object AllowOnlySurfaces {
    /** Positive evidence a detector of an allow-only surface must contain (short view ids). */
    data class Evidence(
        /** At least one of these must be an `all` predicate. */
        val oneOfInAll: Set<String>,
        /** When not empty, at least one of these must be an `all` or `any` predicate. */
        val oneOfInAllOrAny: Set<String> = emptySet(),
        /** Every one of these must be a `none` predicate. */
        val vetoes: Set<String> = emptySet(),
    )

    private val NAMES = setOf("reel_from_dm", "stories", "direct")

    val EVIDENCE: Map<String, Evidence> =
        mapOf(
            "instagram.reel_from_dm" to
                Evidence(
                    oneOfInAll = setOf("sender_username_or_fullname", "sender_timestamp"),
                    oneOfInAllOrAny = setOf("reply_bar_container_scroll_view", "reply_bar_edittext"),
                    vetoes = setOf("suggested_title"),
                ),
            "instagram.stories" to Evidence(oneOfInAll = setOf("reel_viewer_root")),
            "instagram.direct" to
                Evidence(
                    oneOfInAll = setOf("inbox_refreshable_thread_list_recyclerview", "row_thread_composer_edittext"),
                ),
        )

    /** True for `*.reel_from_dm`, `*.stories` and `*.direct`. */
    fun isAllowOnly(surfaceId: String): Boolean = surfaceId.substringAfter('.') in NAMES
}
