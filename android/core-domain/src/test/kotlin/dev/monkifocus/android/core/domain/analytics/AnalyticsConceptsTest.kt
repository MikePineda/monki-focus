// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

import dev.monkifocus.android.core.domain.fixtures.RulesPackage
import dev.monkifocus.android.core.domain.rules.CategoryAssignment
import dev.monkifocus.android.core.domain.rules.SiteTarget
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

/** Unit specs of the analytics concepts the shared fixtures do not pin down on their own. */
class AnalyticsConceptsTest {
    private fun block(
        deviceId: String = "device-a",
        activityKey: String? = "example.org",
        categoryPath: String = "reference",
        source: ActivitySource = ActivitySource.WEB,
        level: Int = 75,
        seconds: Int = 60,
    ) = ActivityBlock(deviceId, "2026-10-26T09:00:00Z", activityKey, categoryPath, level, source, seconds)

    @Test
    fun union_merges_overlapping_and_touching_intervals_and_drops_empty_ones() {
        val union = unionIntervals(listOf(Interval(10, 20), Interval(5, 5), Interval(20, 30), Interval(0, 4), Interval(25, 26)))

        assertEquals(listOf(Interval(0, 4), Interval(10, 30)), union)
    }

    @Test
    fun subtract_leaves_the_uncovered_pieces_in_order() {
        val left = subtractIntervals(listOf(Interval(0, 100)), listOf(Interval(10, 20), Interval(50, 60), Interval(90, 200)))

        assertEquals(listOf(Interval(0, 10), Interval(20, 50), Interval(60, 90)), left)
        assertEquals(emptyList<Interval>(), subtractIntervals(listOf(Interval(5, 10)), listOf(Interval(0, 20))))
    }

    @Test
    fun canonical_block_order_puts_a_null_activity_key_first_and_compares_sources_by_wire_code() {
        val blocks =
            listOf(
                block(source = ActivitySource.WEB),
                block(source = ActivitySource.ANDROID),
                block(activityKey = null),
                block(deviceId = "device-0"),
                block(source = ActivitySource.APP),
            )

        assertEquals(
            listOf(
                block(deviceId = "device-0"),
                block(activityKey = null),
                block(source = ActivitySource.ANDROID),
                block(source = ActivitySource.APP),
                block(source = ActivitySource.WEB),
            ),
            blocks.sortedWith(SYNC_BLOCK_ORDER),
        )
    }

    @Test
    fun largest_remainder_sums_to_the_cap_and_breaks_ties_by_order() {
        val scaled = scaleToCap(listOf("b", "a", "c"), cap = 10, tieOrder = naturalOrder()) { 10L }

        assertEquals(listOf(3L, 4L, 3L), scaled)
        assertEquals(listOf(4L, 5L), scaleToCap(listOf(4L, 5L), cap = 10, tieOrder = naturalOrder()) { it })
    }

    @Test
    fun a_draft_beyond_the_cap_never_becomes_a_block() {
        val draft = BlockDraft.of(block()).copy(seconds = 4_294_967_356L)

        assertThrows(IllegalArgumentException::class.java) { draft.toSyncBlock() }
    }

    @Test
    fun categorise_without_defaults_leaves_unassigned_activity_uncategorised() {
        val activity = CategorisableActivity(ActivitySource.WEB, "youtube.com", "/shorts/abc123DEF45", "youtube.shorts")

        assertEquals(UNCATEGORISED, categorise(activity, emptyList(), RulesPackage.catalog, includeDefaults = false))
        assertEquals(
            CategoryMatch(75, "reference"),
            categorise(
                activity,
                listOf(CategoryAssignment(SiteTarget("youtube.com"), 75, "reference")),
                RulesPackage.catalog,
                includeDefaults = false,
            ),
        )
    }

    @Test
    fun an_app_activity_never_matches_a_site_assignment() {
        val activity = CategorisableActivity(ActivitySource.ANDROID, "org.example.reader", null, null)
        val assignments = listOf(CategoryAssignment(SiteTarget("example.org"), 100, "reference"))

        assertEquals(UNCATEGORISED, categorise(activity, assignments, RulesPackage.catalog))
    }

    @Test
    fun tab_and_attributed_event_never_print_urls_or_titles() {
        val tab = TabProbeInput.Tab("https://example.org/private?q=1", audible = false, incognito = false, title = "Private title")
        val event =
            AttributedEvent(
                "2026-10-26T09:00:00Z",
                60,
                ActivitySource.WEB,
                "example.org",
                "reference",
                75,
                "Private title",
                "https://example.org/x",
            )

        for (text in listOf("$tab", "$event")) {
            assertFalse(text, "Private" in text || "://" in text)
        }
    }

    @Test
    fun probe_keeps_no_title_unless_opted_in_and_none_for_a_locked_screen() {
        val tab = TabProbeInput.Tab("https://example.org/docs?q=1#top", audible = true, incognito = false, title = "Docs")
        val input =
            TabProbeInput("2026-10-26T19:00:00+10:00", true, TabProbeInput.IdleState.ACTIVE, tab, TabProbeInput.Settings(true, false))

        val heartbeat = probeTab(input, RulesPackage.catalog)

        assertEquals(ActivityEvent("2026-10-26T09:00:00Z", 0, EventData.WebTab("example.org", "/docs", null, true, false)), heartbeat)
        assertEquals(
            "Docs",
            (probeTab(input.copy(settings = TabProbeInput.Settings(true, true)), RulesPackage.catalog)?.data as EventData.WebTab).title,
        )
        assertNull(probeTab(input.copy(idleState = TabProbeInput.IdleState.LOCKED), RulesPackage.catalog))
    }

    @Test
    fun heartbeats_merge_only_with_equal_data_inside_the_pulsetime() {
        val editor = EventData.Window("org.example.Editor")
        val events =
            mergeHeartbeats(
                emptyList(),
                listOf(
                    ActivityEvent("2026-10-26T09:00:00Z", 0, editor),
                    ActivityEvent("2026-10-26T09:00:30Z", 0, editor),
                    ActivityEvent("2026-10-26T09:01:00Z", 0, EventData.Window("org.example.Editor", "Draft")),
                ),
                pulsetime = 60,
            )

        assertEquals(listOf(30, 0), events.map { it.duration })
    }
}
