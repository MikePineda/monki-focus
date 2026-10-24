// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * The nodes of one [Screen] read once through a [BoundedTraversal], indexed
 * by view id so id predicates are a map lookup. Lives for one classification
 * and is never persisted.
 */
class ScreenIndex private constructor(
    val screen: Screen,
    val nodes: List<UiNode>,
    val truncated: Boolean,
) {
    private val byViewId: Map<String, List<UiNode>> =
        nodes.filter { it.viewId != null }.groupBy { it.viewId!! }

    /** Nodes whose resource id equals [fullId] exactly. */
    fun withViewId(fullId: String): List<UiNode> = byViewId[fullId].orEmpty()

    companion object {
        fun of(
            screen: Screen,
            traversal: BoundedTraversal = BoundedTraversal(),
        ): ScreenIndex {
            val result = traversal.walk(screen.root)
            return ScreenIndex(screen, result.nodes, result.truncated)
        }
    }
}
