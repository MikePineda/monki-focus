// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * Evaluates the data-only predicates of a detector pack against a
 * [ScreenIndex] (SEMANTICS.md §11).
 *
 * - A short view id (`clips_viewer_view_pager`) is prefixed with the package
 *   of the screen (`com.instagram.android:id/clips_viewer_view_pager`), which
 *   also covers repackaged variants. Only the compiled [COMPOSE_TAGS] (test
 *   tags Compose apps expose as a resource id without a package, such as
 *   `ADDRESSBAR_URL_BOX`) also match verbatim. A qualified id
 *   (`android:id/switch_widget`) is compared as is.
 * - Only nodes of the screen's own package outside any WebView are
 *   candidates ([ScreenIndex]).
 * - View ids are looked up first (index lookup); text and content
 *   descriptions are only read for the candidates, or for every node when a
 *   predicate names no view id. Comparisons are literal and case-sensitive.
 *
 * Node text is compared in memory and never copied, stored or logged.
 */
object PredicateEvaluator {
    /** Compose test tags that stand for a view id without a package prefix. */
    val COMPOSE_TAGS: Set<String> = setOf("ADDRESSBAR_URL_BOX")

    /** True when at least one indexed node satisfies [predicate]. */
    fun matches(
        predicate: NodePredicate,
        index: ScreenIndex,
    ): Boolean = candidates(predicate, index).any { nodeMatches(predicate, it, index.screen) }

    /** Nodes worth testing: the view-id hits when the predicate names an id, otherwise every node. */
    fun candidates(
        predicate: NodePredicate,
        index: ScreenIndex,
    ): List<UiNode> {
        val viewId = predicate.viewId ?: return index.nodes
        return qualifiedIds(viewId, index.screen.packageName).flatMap(index::withViewId)
    }

    /** The resource ids a predicate's [viewId] stands for on a screen of [packageName]. */
    fun qualifiedIds(
        viewId: String,
        packageName: String,
    ): List<String> =
        when {
            ID_SEPARATOR in viewId -> listOf(viewId)
            viewId in COMPOSE_TAGS -> listOf("$packageName$ID_SEPARATOR$viewId", viewId)
            else -> listOf("$packageName$ID_SEPARATOR$viewId")
        }

    fun nodeMatches(
        predicate: NodePredicate,
        node: UiNode,
        screen: Screen,
    ): Boolean {
        val viewId = predicate.viewId
        if (node.packageName != screen.packageName) return false
        if (viewId != null && node.viewId !in qualifiedIds(viewId, screen.packageName)) return false
        if (predicate.className != null && node.className != predicate.className) return false
        if (predicate.selected != null && node.isSelected != predicate.selected) return false
        if (predicate.onScreen != null && isOnScreen(node, screen) != predicate.onScreen) return false
        if (predicate.minHeightRatio != null && node.bounds.height < predicate.minHeightRatio * screen.height) return false
        if (predicate.contentDesc != null && node.contentDescription != predicate.contentDesc) return false
        if (predicate.contentDescPrefix != null && node.contentDescription?.startsWith(predicate.contentDescPrefix) != true) return false
        if (predicate.text != null && node.text != predicate.text) return false
        return true
    }

    private fun isOnScreen(
        node: UiNode,
        screen: Screen,
    ): Boolean = node.isVisibleToUser && screen.shows(node.bounds)

    private const val ID_SEPARATOR = ":id/"
}
