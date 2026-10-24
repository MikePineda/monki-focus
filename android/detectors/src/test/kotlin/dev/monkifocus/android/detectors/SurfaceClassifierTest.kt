// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SurfaceClassifierTest {
    private val classifier = SurfaceClassifier()
    private val packs = RulesResources.bundledPacks

    private fun surfaceOf(dump: String): String? = classifier.classify(RulesResources.screen(dump), packs)?.surface

    @Test
    fun reel_opened_from_a_dm_is_reel_from_dm_not_reels() {
        assertEquals("instagram.reel_from_dm", surfaceOf("com.instagram.android/synthetic/reel_from_dm-01.xml"))
        assertEquals("instagram.reel_from_dm", surfaceOf("com.instagram.android/synthetic/reel_from_dm-02.xml"))
    }

    @Test
    fun dm_reel_with_suggested_title_is_reels() {
        // Swiping on from a DM reel lands on suggested reels: the exemption ends there.
        assertEquals("instagram.reels", surfaceOf("com.instagram.android/synthetic/reels-02.xml"))
    }

    @Test
    fun reels_tab_is_reels() {
        assertEquals("instagram.reels", surfaceOf("com.instagram.android/synthetic/reels-01.xml"))
    }

    @Test
    fun stories_viewer_is_stories() {
        assertEquals("instagram.stories", surfaceOf("com.instagram.android/synthetic/stories-01.xml"))
    }

    @Test
    fun shorts_shelf_on_home_is_not_shorts() {
        // The shelf even reuses the player id for its preview; it covers a quarter of the screen.
        val home = "com.google.android.youtube/synthetic/home-01.xml"

        assertNotEquals("youtube.shorts", surfaceOf(home))
        assertEquals("youtube.home", surfaceOf(home))
    }

    @Test
    fun shorts_player_is_shorts_by_view_id() {
        val match = classifier.classify(RulesResources.screen("com.google.android.youtube/synthetic/shorts-01.xml"), packs)

        assertEquals(SurfaceMatch("youtube.shorts", "youtube", MatchBasis.VIEW_ID), match)
    }

    @Test
    fun renamed_shorts_ids_fall_back_to_the_label_tier() {
        val match = classifier.classify(RulesResources.screen("com.google.android.youtube/synthetic/shorts-02.xml"), packs)

        assertEquals(SurfaceMatch("youtube.shorts", "youtube", MatchBasis.LABEL), match)
    }

    @Test
    fun detectors_run_by_descending_priority() {
        val pager = NodePredicate(viewId = "pager")
        val pack =
            aPack(
                surfaces =
                    arrayOf(
                        SurfaceDetector("instagram.home", 10, all = listOf(pager)),
                        SurfaceDetector("instagram.reels", 90, all = listOf(pager)),
                    ),
            )

        val match = classifier.classify(window("com.instagram.android", TestNode("com.instagram.android:id/pager")), listOf(pack))

        assertEquals("instagram.reels", match?.surface)
    }

    @Test
    fun equal_priorities_are_ordered_by_surface_id() {
        val pager = NodePredicate(viewId = "pager")
        val pack =
            aPack(
                surfaces =
                    arrayOf(
                        SurfaceDetector("instagram.stories", 50, all = listOf(pager)),
                        SurfaceDetector("instagram.explore", 50, all = listOf(pager)),
                        SurfaceDetector("instagram.reels", 50, all = listOf(pager)),
                    ),
            )

        val match = classifier.classify(window("com.instagram.android", TestNode("com.instagram.android:id/pager")), listOf(pack))

        assertEquals("instagram.explore", match?.surface)
    }

    @Test
    fun any_list_needs_one_match_and_none_list_vetoes() {
        val detector =
            SurfaceDetector(
                "instagram.reels",
                90,
                all = listOf(NodePredicate(viewId = "pager")),
                any = listOf(NodePredicate(viewId = "a"), NodePredicate(viewId = "b")),
                none = listOf(NodePredicate(viewId = "veto")),
            )
        val pack = aPack(surfaces = arrayOf(detector))

        fun id(name: String) = TestNode("com.instagram.android:id/$name")

        assertNull(classifier.classify(window("com.instagram.android", id("pager")), listOf(pack)))
        assertEquals("instagram.reels", classifier.classify(window("com.instagram.android", id("pager"), id("b")), listOf(pack))?.surface)
        assertNull(classifier.classify(window("com.instagram.android", id("pager"), id("b"), id("veto")), listOf(pack)))
    }

    @Test
    fun short_view_ids_are_prefixed_with_the_matching_package() {
        val pack =
            aPack(
                packages = listOf("com.instagram.android", "com.example.instavariant"),
                surfaces = arrayOf(SurfaceDetector("instagram.reels", 90, all = listOf(NodePredicate(viewId = "pager")))),
            )

        val variant = window("com.example.instavariant", TestNode("com.example.instavariant:id/pager"))
        val foreignId = window("com.example.instavariant", TestNode("com.instagram.android:id/pager"))

        assertEquals("instagram.reels", classifier.classify(variant, listOf(pack))?.surface)
        assertNull(classifier.classify(foreignId, listOf(pack)))
    }

    @Test
    fun a_package_no_pack_names_is_never_classified() {
        val screen = RulesResources.screen("com.instagram.android/synthetic/reels-01.xml").copy(packageName = "com.example.other")

        assertNull(classifier.classify(screen, packs))
    }

    @Test
    fun a_marker_beyond_the_traversal_bounds_is_not_seen() {
        var deepest = TestNode("com.instagram.android:id/pager")
        repeat(BoundedTraversal.MAX_DEPTH) { deepest = TestNode(children = listOf(deepest)) }
        val pack = aPack(surfaces = arrayOf(SurfaceDetector("instagram.reels", 90, all = listOf(NodePredicate(viewId = "pager")))))

        // Root (depth 0) + 40 wrappers puts the marker at depth 41.
        assertNull(classifier.classify(window("com.instagram.android", deepest), listOf(pack)))
        assertEquals(
            "instagram.reels",
            classifier.classify(window("com.instagram.android", deepest.children.single()), listOf(pack))?.surface,
        )
    }
}
