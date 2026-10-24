// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PackInvariantsTest {
    private val invariants = PackInvariants(RulesResources.registeredSurfaces)
    private val instagram = RulesResources.bundledPack("instagram")

    private fun DetectorPack.withSurfaces(vararg detectors: SurfaceDetector) = copy(surfaces = detectors.toList())

    private val reels =
        SurfaceDetector("instagram.reels", 90, all = listOf(NodePredicate(viewId = "clips_viewer_view_pager", onScreen = true)))

    @Test
    fun every_bundled_pack_holds() {
        RulesResources.bundledPacks.forEach { assertTrue(it.packId, invariants.holds(it)) }
    }

    @Test
    fun an_app_pack_needs_surfaces() {
        assertFalse(invariants.holds(instagram.withSurfaces()))
    }

    @Test
    fun surfaces_stay_in_the_pack_family_and_the_registry() {
        val foreign = SurfaceDetector("youtube.shorts", 90, all = listOf(NodePredicate(viewId = "reel_recycler")))
        val unknown = SurfaceDetector("instagram.invented", 90, all = listOf(NodePredicate(viewId = "pager")))

        assertFalse(invariants.holds(instagram.withSurfaces(reels, foreign)))
        assertFalse(invariants.holds(instagram.withSurfaces(reels, unknown)))
        assertTrue(invariants.holds(instagram.withSurfaces(reels)))
    }

    @Test
    fun the_settings_pack_covers_every_guarded_screen() {
        val settings = RulesResources.bundledPack("settings")

        assertFalse(invariants.holds(settings.copy(surfaces = settings.surfaces.filter { it.surface != "guard.uninstall" })))
        assertFalse(
            invariants.holds(
                settings.copy(
                    surfaces =
                        settings.surfaces + SurfaceDetector("instagram.reels", 1, all = listOf(NodePredicate(viewId = "x"))),
                ),
            ),
        )
    }

    @Test
    fun instagram_and_youtube_keep_the_safety_net() {
        assertFalse(invariants.holds(instagram.copy(unclassifiedCapMinutes = 4)))
        assertFalse(invariants.holds(RulesResources.bundledPack("youtube").copy(unclassifiedCapMinutes = 0)))
        assertTrue(invariants.holds(instagram.copy(unclassifiedCapMinutes = 5)))
    }

    @Test
    fun an_allow_only_surface_needs_its_compiled_evidence() {
        val pager = NodePredicate(viewId = "clips_viewer_view_pager", onScreen = true)
        val replyBar = NodePredicate(viewId = "reply_bar_edittext")
        val veto = NodePredicate(viewId = "suggested_title")
        val sender = NodePredicate(viewId = "sender_timestamp")

        val noSender = SurfaceDetector("instagram.reel_from_dm", 100, all = listOf(pager), any = listOf(replyBar), none = listOf(veto))
        val noVeto = SurfaceDetector("instagram.reel_from_dm", 100, all = listOf(pager, sender), any = listOf(replyBar))
        val noReplyBar = SurfaceDetector("instagram.reel_from_dm", 100, all = listOf(pager, sender), none = listOf(veto))
        val senderOnlyInAny =
            SurfaceDetector("instagram.reel_from_dm", 100, all = listOf(pager, replyBar), any = listOf(sender), none = listOf(veto))
        val complete =
            SurfaceDetector("instagram.reel_from_dm", 100, all = listOf(pager, sender), any = listOf(replyBar), none = listOf(veto))
        val anyStories = SurfaceDetector("instagram.stories", 80, any = listOf(NodePredicate(viewId = "tab_bar")))

        listOf(noSender, noVeto, noReplyBar, senderOnlyInAny, anyStories).forEach {
            assertFalse(it.toString(), invariants.holds(instagram.withSurfaces(reels, it)))
        }
        assertTrue(invariants.holds(instagram.withSurfaces(reels, complete)))
    }

    @Test
    fun a_label_predicate_must_name_a_view_id() {
        val textProbe = SurfaceDetector("instagram.home", 10, all = listOf(NodePredicate(text = "Home")))
        val scoped = SurfaceDetector("instagram.home", 10, all = listOf(NodePredicate(viewId = "feed_tab", contentDesc = "Home")))

        assertFalse(invariants.holds(instagram.withSurfaces(reels, textProbe)))
        assertTrue(invariants.holds(instagram.withSurfaces(reels, scoped)))
    }

    @Test
    fun the_browser_pack_has_url_bars_and_no_surfaces() {
        val browsers = RulesResources.bundledPack("browsers")

        assertFalse(invariants.holds(browsers.copy(urlBarViewIds = emptyList())))
        assertFalse(invariants.holds(browsers.withSurfaces(reels)))
        assertFalse(invariants.holds(instagram.copy(urlBarViewIds = listOf("url_bar"))))
    }

    @Test
    fun an_unknown_pack_id_never_holds() {
        assertFalse(invariants.holds(instagram.copy(packId = "tiktok")))
    }
}
