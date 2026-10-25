// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.ui

import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import dev.monkifocus.android.core.domain.analytics.ActivityBlock
import dev.monkifocus.android.core.domain.analytics.ActivitySource
import dev.monkifocus.android.core.domain.ports.IntentionOutcome
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.feature.stats.model.StatsScreenState
import dev.monkifocus.android.feature.stats.model.StatsTestData
import dev.monkifocus.android.feature.stats.model.StatsTestData.at
import dev.monkifocus.android.feature.stats.model.StatsTestData.block
import dev.monkifocus.android.feature.stats.model.TodayStatsQuery
import dev.monkifocus.android.feature.stats.model.WeekStatsQuery
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class StatsScreenTest {
    @get:Rule
    val compose = createComposeRule()

    private val calls = mutableListOf<String>()
    private val now = at("2026-10-25T20:00:00Z")

    private fun show(state: StatsScreenState) {
        compose.setContent {
            MonkiTheme {
                StatsScreen(
                    state = state,
                    onBack = { calls += "back" },
                    onFixUsageAccess = { calls += "fix" },
                    onRetry = { calls += "retry" },
                )
            }
        }
    }

    private fun ready(
        blocks: List<ActivityBlock>,
        usageAccessMissing: Boolean = false,
    ): StatsScreenState.Ready {
        val intentions = listOf(StatsTestData.intention("2026-10-25T09:00:00Z", IntentionOutcome.KEPT))
        return StatsScreenState.Ready(
            today = TodayStatsQuery.compute(blocks, intentions, now, StatsTestData.ZONE),
            week = WeekStatsQuery.compute(blocks, now, StatsTestData.ZONE),
            usageAccessMissing = usageAccessMissing,
        )
    }

    @Test
    fun without_usage_access_it_explains_and_offers_the_fix() {
        show(StatsScreenState.NoUsageAccess)

        compose.onNodeWithText("Usage access is off").assertIsDisplayed()
        compose.onNodeWithTag(StatsTestTags.FIX_ACCESS).performClick()

        assertEquals(listOf("fix"), calls)
    }

    @Test
    fun with_no_data_yet_it_says_when_data_appears() {
        show(StatsScreenState.NoDataYet)

        compose.onNodeWithTag(StatsTestTags.EMPTY).assertIsDisplayed()
    }

    @Test
    fun a_day_without_tracked_time_shows_a_dash_for_the_pulse() {
        // Only yesterday has time: the week has data, today has no pulse.
        show(ready(listOf(block("2026-10-24T09:00:00Z", "com.example.notes", 100))))

        compose.onNodeWithTag(StatsTestTags.PULSE).assertContentDescriptionEquals("Pulse today: —, Nothing tracked yet today")
    }

    @Test
    fun todays_pulse_levels_top_sites_and_intentions_are_shown() {
        show(
            ready(
                listOf(
                    block("2026-10-25T09:00:00Z", "video.example", 0, source = ActivitySource.WEB),
                    block("2026-10-25T09:05:00Z", "docs.example", 100, source = ActivitySource.WEB),
                ),
            ),
        )

        compose.onNodeWithTag(StatsTestTags.PULSE).assertContentDescriptionEquals("Pulse today: 50, of 100 · 10 min tracked")
        compose.onNodeWithText("Distracting: 5 min").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("video.example").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Started: 1 · kept: 1 · broken: 0 · dropped: 0").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun every_chart_has_a_table_view() {
        show(ready(listOf(block("2026-10-25T09:00:00Z", "video.example", 0, source = ActivitySource.WEB))))

        compose.onNodeWithTag(StatsTestTags.LEVEL_TABLE).assertDoesNotExist()
        compose.onNodeWithTag(StatsTestTags.toggle(StatsTestTags.LEVEL_BAR)).performScrollTo()
        compose.onNode(hasText("Table") and hasAnyAncestor(hasTestTag(StatsTestTags.toggle(StatsTestTags.LEVEL_BAR)))).performClick()
        compose.onNodeWithTag(StatsTestTags.LEVEL_TABLE).performScrollTo().assertIsDisplayed()
    }

    @Test
    fun recorded_data_without_access_keeps_the_fix_on_top() {
        show(ready(listOf(block("2026-10-25T09:00:00Z", "video.example", 0, source = ActivitySource.WEB)), usageAccessMissing = true))

        compose.onNodeWithText("Usage access is off, so new time is not counted.").assertIsDisplayed()
        compose.onNodeWithTag(StatsTestTags.FIX_ACCESS).performClick()
        compose.onNodeWithTag(StatsTestTags.BACK).performClick()

        assertEquals(listOf("fix", "back"), calls)
    }

    @Test
    fun a_failed_load_offers_a_retry() {
        show(StatsScreenState.Failed)

        compose.onNodeWithTag(StatsTestTags.RETRY).performClick()

        assertEquals(listOf("retry"), calls)
    }
}
