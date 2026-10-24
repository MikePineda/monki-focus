// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DmReelSessionTest {
    private fun match(surface: String) = SurfaceMatch(surface, "instagram", MatchBasis.VIEW_ID)

    private val direct = match("instagram.direct")
    private val dmReel = match("instagram.reel_from_dm")
    private val second = 1_000L

    /** Feeds (time, raw match) pairs and returns the surfaces acted on. */
    private fun run(vararg steps: Pair<Long, SurfaceMatch?>): List<String?> {
        var session = DmReelSession.INITIAL
        return steps.map { (at, raw) ->
            val step = session.observe(raw, at)
            session = step.session
            step.match?.surface
        }
    }

    @Test
    fun a_reel_opened_from_the_inbox_is_a_dm_reel() {
        assertEquals(listOf("instagram.direct", "instagram.reel_from_dm"), run(0L to direct, 2 * second to dmReel))
    }

    @Test
    fun a_dm_looking_reel_without_the_inbox_first_is_reels() {
        assertEquals(listOf("instagram.reels"), run(0L to dmReel))
        assertEquals(listOf("instagram.home", "instagram.reels"), run(0L to match("instagram.home"), second to dmReel))
    }

    @Test
    fun the_inbox_must_be_at_most_five_seconds_back() {
        assertEquals(listOf("instagram.direct", "instagram.reels"), run(0L to direct, 6 * second to dmReel))
    }

    @Test
    fun the_session_continues_while_the_dm_reel_stays_on_screen() {
        val surfaces = run(0L to direct, second to dmReel, 30 * second to dmReel, 90 * second to null, 100 * second to dmReel)

        assertEquals(
            listOf("instagram.direct", "instagram.reel_from_dm", "instagram.reel_from_dm", null, "instagram.reel_from_dm"),
            surfaces,
        )
    }

    @Test
    fun the_session_ends_after_120_seconds_and_the_same_screen_becomes_reels() {
        val surfaces = run(0L to direct, second to dmReel, 121 * second to dmReel, 122 * second to dmReel, 150 * second to dmReel)

        assertEquals(
            listOf("instagram.direct", "instagram.reel_from_dm", "instagram.reel_from_dm", "instagram.reels", "instagram.reels"),
            surfaces,
        )
    }

    @Test
    fun another_surface_ends_the_session() {
        val surfaces = run(0L to direct, second to dmReel, 2 * second to match("instagram.reels"), 3 * second to dmReel)

        assertEquals("instagram.reels", surfaces.last())
    }

    @Test
    fun going_back_to_the_inbox_starts_a_new_session() {
        val surfaces = run(0L to direct, second to dmReel, 200 * second to dmReel, 201 * second to direct, 202 * second to dmReel)

        assertEquals(
            listOf("instagram.direct", "instagram.reel_from_dm", "instagram.reels", "instagram.direct", "instagram.reel_from_dm"),
            surfaces,
        )
    }

    @Test
    fun unclassified_reads_change_nothing() {
        val step = DmReelSession.INITIAL.observe(null, 0)

        assertNull(step.match)
        assertEquals(listOf(null, "instagram.reels"), run(0L to null, second to dmReel))
    }

    @Test
    fun the_fixture_dm_reels_need_the_inbox_first() {
        val classifier = SurfaceClassifier()
        val packs = RulesResources.bundledPacks

        fun raw(dump: String) = classifier.classify(RulesResources.screen("com.instagram.android/synthetic/$dump"), packs)

        val fromInbox = run(0L to raw("direct-01.xml"), 2 * second to raw("reel_from_dm-01.xml"))
        val cold = run(0L to raw("reel_from_dm-01.xml"))

        assertEquals(listOf("instagram.direct", "instagram.reel_from_dm"), fromInbox)
        assertEquals(listOf("instagram.reels"), cold)
    }
}
