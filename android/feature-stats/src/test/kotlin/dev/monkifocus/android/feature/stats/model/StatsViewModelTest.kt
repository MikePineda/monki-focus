// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.model

import dev.monkifocus.android.core.domain.ports.IntentionOutcome
import dev.monkifocus.android.feature.stats.model.StatsTestData.at
import dev.monkifocus.android.feature.stats.model.StatsTestData.block
import dev.monkifocus.android.feature.stats.model.StatsTestData.intention
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class StatsViewModelTest {
    private val blocks = ListBlockRepository()
    private val intentions = ListIntentionRepository()
    private var access = true
    private val loader = StatsLoader(blocks, intentions, { access }, { StatsTestData.ZONE })
    private val nowMillis = at("2026-10-25T20:00:00Z") * 1_000

    private fun TestScope.viewModel() = StatsViewModel(loader, { nowMillis }, this)

    @Test
    fun it_starts_loading() =
        runTest {
            assertEquals(StatsScreenState.Loading, viewModel().state.value)
        }

    @Test
    fun without_usage_access_and_data_it_explains_the_permission() =
        runTest {
            access = false
            val model = viewModel()

            model.refresh()
            advanceUntilIdle()

            assertEquals(StatsScreenState.NoUsageAccess, model.state.value)
        }

    @Test
    fun with_access_but_nothing_counted_yet_it_says_data_is_coming() =
        runTest {
            val model = viewModel()

            model.refresh()
            advanceUntilIdle()

            assertEquals(StatsScreenState.NoDataYet, model.state.value)
        }

    @Test
    fun recorded_time_is_shown_even_after_usage_access_was_revoked() =
        runTest {
            access = false
            blocks.blocks = listOf(block("2026-10-25T09:00:00Z", "com.example.notes", 100))
            val model = viewModel()

            model.refresh()
            advanceUntilIdle()

            val ready = model.state.value as StatsScreenState.Ready
            assertTrue(ready.usageAccessMissing)
            assertEquals(100, ready.today.pulse)
            assertEquals(
                300L,
                ready.week.days
                    .last()
                    .totalSeconds,
            )
        }

    @Test
    fun intentions_alone_are_something_to_show() =
        runTest {
            intentions.intentions = listOf(intention("2026-10-25T09:00:00Z", IntentionOutcome.KEPT))
            val model = viewModel()

            model.refresh()
            advanceUntilIdle()

            assertEquals(1, (model.state.value as StatsScreenState.Ready).today.intentions.kept)
        }

    @Test
    fun a_store_that_cannot_be_read_shows_the_failure() =
        runTest {
            blocks.failing = true
            val model = viewModel()

            model.refresh()
            advanceUntilIdle()

            assertEquals(StatsScreenState.Failed, model.state.value)
        }

    @Test
    fun durations_round_to_the_nearest_minute() {
        assertEquals(DurationParts(0, 0), DurationParts.of(29))
        assertEquals(DurationParts(0, 1), DurationParts.of(30))
        assertEquals(DurationParts(1, 5), DurationParts.of(3_900))
    }
}
