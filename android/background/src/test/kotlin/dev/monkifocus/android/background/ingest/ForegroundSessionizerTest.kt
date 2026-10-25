// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.ingest

import dev.monkifocus.android.core.domain.usage.DeviceUsageEvent
import dev.monkifocus.android.core.domain.usage.UsageEventKind
import org.junit.Assert.assertEquals
import org.junit.Test

class ForegroundSessionizerTest {
    private fun resumed(
        at: Long,
        pkg: String,
    ) = DeviceUsageEvent(UsageEventKind.ACTIVITY_RESUMED, at, pkg)

    private fun paused(
        at: Long,
        pkg: String,
    ) = DeviceUsageEvent(UsageEventKind.ACTIVITY_PAUSED, at, pkg)

    private fun system(
        at: Long,
        kind: UsageEventKind,
    ) = DeviceUsageEvent(kind, at, null)

    @Test
    fun an_app_is_in_front_from_its_resume_to_its_pause() {
        val sessions = ForegroundSessionizer.sessionize(listOf(resumed(1_000, "app.a"), paused(61_000, "app.a")), 0, 100_000)

        assertEquals(listOf(ForegroundSession("app.a", 1_000, 61_000)), sessions)
    }

    @Test
    fun resuming_another_app_ends_the_previous_one_and_a_late_pause_is_ignored() {
        val sessions =
            ForegroundSessionizer.sessionize(
                listOf(resumed(0, "app.a"), resumed(10_000, "app.b"), paused(10_200, "app.a"), paused(20_000, "app.b")),
                0,
                100_000,
            )

        assertEquals(listOf(ForegroundSession("app.a", 0, 10_000), ForegroundSession("app.b", 10_000, 20_000)), sessions)
    }

    @Test
    fun sessions_never_overlap() {
        val sessions =
            ForegroundSessionizer.sessionize(
                listOf(
                    resumed(0, "app.a"),
                    resumed(5_000, "app.b"),
                    resumed(6_000, "app.a"),
                    resumed(6_000, "app.a"),
                    paused(9_000, "app.a"),
                ),
                0,
                100_000,
            )

        sessions.zipWithNext().forEach { (first, second) -> assert(first.endMillis <= second.startMillis) }
        assertEquals(3, sessions.size)
    }

    @Test
    fun the_screen_turning_off_the_keyguard_or_a_shutdown_end_the_session() {
        UsageEventKind.entries
            .filter {
                it == UsageEventKind.SCREEN_NON_INTERACTIVE || it == UsageEventKind.KEYGUARD_SHOWN ||
                    it == UsageEventKind.DEVICE_SHUTDOWN
            }.forEach { kind ->
                val sessions = ForegroundSessionizer.sessionize(listOf(resumed(0, "app.a"), system(30_000, kind)), 0, 100_000)

                assertEquals("$kind", listOf(ForegroundSession("app.a", 0, 30_000)), sessions)
            }
    }

    @Test
    fun the_screen_turning_on_opens_nothing_by_itself() {
        val sessions =
            ForegroundSessionizer.sessionize(
                listOf(system(0, UsageEventKind.SCREEN_INTERACTIVE), system(1_000, UsageEventKind.KEYGUARD_HIDDEN)),
                0,
                100_000,
            )

        assertEquals(emptyList<ForegroundSession>(), sessions)
    }

    @Test
    fun an_app_still_in_front_at_the_end_is_an_open_session_up_to_the_end() {
        val sessions = ForegroundSessionizer.sessionize(listOf(resumed(40_000, "app.a")), 0, 100_000)

        assertEquals(listOf(ForegroundSession("app.a", 40_000, 100_000, open = true)), sessions)
    }

    @Test
    fun a_carried_session_continues_from_its_own_start() {
        val carried = ForegroundSession("app.a", 10_000, 50_000)

        val sessions = ForegroundSessionizer.sessionize(listOf(paused(70_000, "app.a")), 50_000, 100_000, carried)

        assertEquals(listOf(ForegroundSession("app.a", 10_000, 70_000)), sessions)
    }

    @Test
    fun a_carried_session_without_events_stays_open_to_the_end() {
        val carried = ForegroundSession("app.a", 10_000, 50_000, open = true)

        val sessions = ForegroundSessionizer.sessionize(emptyList(), 50_000, 100_000, carried)

        assertEquals(listOf(ForegroundSession("app.a", 10_000, 100_000, open = true)), sessions)
    }

    @Test
    fun events_outside_the_window_and_zero_length_sessions_are_dropped() {
        val sessions =
            ForegroundSessionizer.sessionize(
                listOf(resumed(5_000, "app.old"), resumed(20_000, "app.a"), resumed(20_000, "app.b"), paused(30_000, "app.b")),
                10_000,
                100_000,
            )

        assertEquals(listOf(ForegroundSession("app.b", 20_000, 30_000)), sessions)
    }
}
