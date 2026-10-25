// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.ingest

import dev.monkifocus.android.core.domain.analytics.AfkStatus
import dev.monkifocus.android.core.domain.usage.DeviceUsageEvent
import dev.monkifocus.android.core.domain.usage.UsageEventKind
import org.junit.Assert.assertEquals
import org.junit.Test

class AfkSessionizerTest {
    private fun system(
        at: Long,
        kind: UsageEventKind,
    ) = DeviceUsageEvent(kind, at, null)

    @Test
    fun the_user_is_away_while_the_screen_is_off() {
        val periods =
            AfkSessionizer.periods(
                listOf(system(10_000, UsageEventKind.SCREEN_NON_INTERACTIVE), system(40_000, UsageEventKind.SCREEN_INTERACTIVE)),
                0,
                100_000,
            )

        assertEquals(
            listOf(
                AfkPeriod(AfkStatus.NOT_AFK, 0, 10_000),
                AfkPeriod(AfkStatus.AFK, 10_000, 40_000),
                AfkPeriod(AfkStatus.NOT_AFK, 40_000, 100_000, open = true),
            ),
            periods,
        )
    }

    @Test
    fun the_lock_screen_counts_as_away_until_the_keyguard_hides() {
        val periods =
            AfkSessionizer.periods(
                listOf(
                    system(10_000, UsageEventKind.KEYGUARD_SHOWN),
                    system(12_000, UsageEventKind.SCREEN_NON_INTERACTIVE),
                    system(30_000, UsageEventKind.SCREEN_INTERACTIVE),
                    system(35_000, UsageEventKind.KEYGUARD_HIDDEN),
                ),
                0,
                100_000,
            )

        assertEquals(
            listOf(
                AfkPeriod(AfkStatus.NOT_AFK, 0, 10_000),
                AfkPeriod(AfkStatus.AFK, 10_000, 35_000),
                AfkPeriod(AfkStatus.NOT_AFK, 35_000, 100_000, open = true),
            ),
            periods,
        )
    }

    @Test
    fun a_shutdown_is_away_until_the_screen_comes_back() {
        val periods =
            AfkSessionizer.periods(
                listOf(system(10_000, UsageEventKind.DEVICE_SHUTDOWN), system(60_000, UsageEventKind.SCREEN_INTERACTIVE)),
                0,
                100_000,
            )

        assertEquals(AfkPeriod(AfkStatus.AFK, 10_000, 60_000), periods[1])
    }

    @Test
    fun a_carried_away_period_continues_from_its_own_start() {
        val carried = AfkPeriod(AfkStatus.AFK, 5_000, 50_000, open = true)

        val periods = AfkSessionizer.periods(listOf(system(70_000, UsageEventKind.SCREEN_INTERACTIVE)), 50_000, 100_000, carried)

        assertEquals(
            listOf(AfkPeriod(AfkStatus.AFK, 5_000, 70_000), AfkPeriod(AfkStatus.NOT_AFK, 70_000, 100_000, open = true)),
            periods,
        )
    }

    @Test
    fun app_events_and_repeated_states_change_nothing() {
        val periods =
            AfkSessionizer.periods(
                listOf(
                    DeviceUsageEvent(UsageEventKind.ACTIVITY_RESUMED, 1_000, "app.a"),
                    system(2_000, UsageEventKind.SCREEN_INTERACTIVE),
                    system(3_000, UsageEventKind.KEYGUARD_HIDDEN),
                ),
                0,
                100_000,
            )

        assertEquals(listOf(AfkPeriod(AfkStatus.NOT_AFK, 0, 100_000, open = true)), periods)
    }
}
