// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BoundedTraversalTest {
    @Test
    fun traversal_visits_at_most_2500_nodes() {
        val wide = TestNode(children = List(10_000) { TestNode() })

        val result = BoundedTraversal().walk(wide)

        assertEquals(2_500, result.nodes.size)
        assertTrue(result.truncated)
    }

    @Test
    fun traversal_stops_at_depth_40() {
        var chain = TestNode(viewId = "leaf")
        repeat(100) { chain = TestNode(children = listOf(chain)) }

        val result = BoundedTraversal().walk(chain)

        assertEquals(41, result.nodes.size) // depths 0..40
        assertTrue(result.truncated)
        assertFalse(result.nodes.any { it.viewId == "leaf" })
    }

    @Test
    fun breadth_first_keeps_shallow_structure_when_a_list_hits_the_cap() {
        val hugeList = TestNode(viewId = "list", children = List(5_000) { TestNode() })
        val tabBar = TestNode(viewId = "tab_bar")

        val result = BoundedTraversal().walk(TestNode(children = listOf(hugeList, tabBar)))

        assertTrue(result.nodes.any { it.viewId == "tab_bar" })
    }

    @Test
    fun a_small_tree_is_walked_whole() {
        val result = BoundedTraversal().walk(TestNode(children = listOf(TestNode(), TestNode(children = listOf(TestNode())))))

        assertEquals(4, result.nodes.size)
        assertFalse(result.truncated)
    }
}
