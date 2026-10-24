// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PredicateEvaluatorTest {
    private val pkg = "com.example.feed"

    private fun holds(
        predicate: NodePredicate,
        vararg nodes: TestNode,
    ): Boolean = PredicateEvaluator.matches(predicate, ScreenIndex.of(window(pkg, *nodes)))

    @Test
    fun on_screen_needs_a_visible_node_inside_the_screen() {
        val onScreen = NodePredicate(viewId = "pager", onScreen = true)

        assertTrue(holds(onScreen, TestNode("$pkg:id/pager", bounds = Rect(0, 0, 1080, 2000))))
        assertFalse(holds(onScreen, TestNode("$pkg:id/pager", bounds = Rect(0, 2400, 1080, 4800))))
        assertFalse(holds(onScreen, TestNode("$pkg:id/pager", bounds = Rect(0, 0, 1080, 2000), isVisibleToUser = false)))
        assertFalse(holds(onScreen, TestNode("$pkg:id/pager", bounds = Rect(0, 0, 0, 0))))
        assertTrue(holds(NodePredicate(viewId = "pager", onScreen = false), TestNode("$pkg:id/pager", bounds = Rect(-1080, 0, 0, 2000))))
    }

    @Test
    fun min_height_ratio_is_relative_to_the_screen_height() {
        val tall = NodePredicate(viewId = "player", minHeightRatio = 0.6)

        assertTrue(holds(tall, TestNode("$pkg:id/player", bounds = Rect(0, 0, 1080, 1440))))
        assertFalse(holds(tall, TestNode("$pkg:id/player", bounds = Rect(0, 0, 1080, 1439))))
    }

    @Test
    fun selected_compares_the_selection_flag() {
        val selected = NodePredicate(contentDesc = "Shorts", selected = true)

        assertTrue(holds(selected, TestNode(contentDescValue = "Shorts", isSelected = true)))
        assertFalse(holds(selected, TestNode(contentDescValue = "Shorts")))
    }

    @Test
    fun labels_are_literal_and_case_sensitive() {
        assertTrue(holds(NodePredicate(text = "Reels"), TestNode(textValue = "Reels")))
        assertFalse(holds(NodePredicate(text = "Reels"), TestNode(textValue = "reels")))
        assertFalse(holds(NodePredicate(text = "Re.*"), TestNode(textValue = "Reels")))
        assertTrue(holds(NodePredicate(contentDescPrefix = "Reels,"), TestNode(contentDescValue = "Reels, 3 new")))
        assertFalse(holds(NodePredicate(contentDescPrefix = "Reels,"), TestNode(contentDescValue = "Reels")))
    }

    @Test
    fun class_name_is_compared_exactly() {
        val list = NodePredicate(viewId = "list", className = "androidx.recyclerview.widget.RecyclerView")

        assertTrue(holds(list, TestNode("$pkg:id/list", className = "androidx.recyclerview.widget.RecyclerView")))
        assertFalse(holds(list, TestNode("$pkg:id/list", className = "android.widget.ListView")))
    }

    @Test
    fun qualified_ids_are_compared_as_is() {
        val framework = NodePredicate(viewId = "android:id/switch_widget")

        assertTrue(holds(framework, TestNode("android:id/switch_widget")))
        assertFalse(holds(framework, TestNode("$pkg:id/switch_widget")))
    }

    @Test
    fun a_short_id_also_matches_an_unqualified_compose_test_tag() {
        assertTrue(holds(NodePredicate(viewId = "ADDRESSBAR_URL_BOX"), TestNode("ADDRESSBAR_URL_BOX")))
        assertFalse(holds(NodePredicate(viewId = "ADDRESSBAR_URL_BOX"), TestNode("com.example.other:id/ADDRESSBAR_URL_BOX")))
    }

    @Test
    fun every_field_of_a_predicate_must_hold_on_the_same_node() {
        val predicate = NodePredicate(viewId = "tab", contentDesc = "Home", selected = true)

        assertFalse(
            holds(predicate, TestNode("$pkg:id/tab", contentDescValue = "Home"), TestNode(contentDescValue = "Home", isSelected = true)),
        )
        assertTrue(holds(predicate, TestNode("$pkg:id/tab", contentDescValue = "Home", isSelected = true)))
    }
}
