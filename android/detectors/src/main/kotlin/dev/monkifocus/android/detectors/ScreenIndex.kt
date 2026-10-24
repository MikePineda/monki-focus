// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * The nodes of one [Screen] read once through a [BoundedTraversal], indexed
 * by view id so id predicates are a map lookup. Lives for one classification
 * and is never persisted.
 *
 * Only nodes the foreground app itself draws count:
 * - a node whose package differs from the screen's package (another app's
 *   overlay, a node without a package) is left out;
 * - nothing below a WebView is visited: web pages choose their own element
 *   ids and text (Chromium exposes an HTML `id` as the resource id), so a
 *   page could otherwise impersonate a URL bar or an app view.
 */
class ScreenIndex private constructor(
    val screen: Screen,
    val nodes: List<UiNode>,
    /** True when a traversal bound cut the read short: absence of a node proves nothing. */
    val truncated: Boolean,
) {
    private val byViewId: Map<String, List<UiNode>> =
        nodes.mapNotNull { node -> node.viewId?.let { it to node } }.groupBy({ it.first }, { it.second })

    /** Nodes whose resource id equals [fullId] exactly. */
    fun withViewId(fullId: String): List<UiNode> = byViewId[fullId].orEmpty()

    companion object {
        fun of(
            screen: Screen,
            traversal: BoundedTraversal = BoundedTraversal(),
        ): ScreenIndex {
            val result = traversal.walk(screen.root, skipChildrenOf = ::isWebContent)
            return ScreenIndex(screen, result.nodes.filter { it.packageName == screen.packageName }, result.truncated)
        }

        /** True for a WebView, whose subtree is page content. */
        fun isWebContent(node: UiNode): Boolean = node.className?.contains(WEB_VIEW) == true

        private const val WEB_VIEW = "WebView"
    }
}
