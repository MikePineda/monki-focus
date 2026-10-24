// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * Walks a UI tree breadth first, visiting at most [maxNodes] nodes and none
 * deeper than [maxDepth] (the root is depth 0). Breadth first keeps the
 * shallow structure (bars, pagers, toolbars) when a huge list hits the cap.
 * Only references are collected: no node text is copied.
 */
class BoundedTraversal(
    val maxNodes: Int = MAX_NODES,
    val maxDepth: Int = MAX_DEPTH,
) {
    init {
        require(maxNodes > 0 && maxDepth >= 0) { "bounds must be positive" }
    }

    /** The visited nodes in breadth-first order and whether a bound cut the walk short. */
    data class Result(
        val nodes: List<UiNode>,
        val truncated: Boolean,
    )

    fun walk(root: UiNode): Result {
        val visited = ArrayList<UiNode>()
        val queue = ArrayDeque<Pair<UiNode, Int>>()
        queue.addLast(root to 0)
        var truncated = false
        while (queue.isNotEmpty()) {
            if (visited.size == maxNodes) {
                truncated = true
                break
            }
            val (node, depth) = queue.removeFirst()
            visited += node
            val children = node.children
            if (children.isEmpty()) continue
            if (depth == maxDepth) {
                truncated = true
                continue
            }
            children.forEach { queue.addLast(it to depth + 1) }
        }
        return Result(visited, truncated)
    }

    companion object {
        /** Plan §2.2: at most 2,500 nodes per screen read. */
        const val MAX_NODES = 2_500

        /** Plan §2.2: at most 40 levels below the root. */
        const val MAX_DEPTH = 40
    }
}
