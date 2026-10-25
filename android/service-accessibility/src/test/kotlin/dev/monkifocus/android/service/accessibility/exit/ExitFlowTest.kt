// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.exit

import dev.monkifocus.android.service.accessibility.bypass.BypassRecorder
import dev.monkifocus.android.service.accessibility.support.MemoryExitFlowStore
import dev.monkifocus.android.service.accessibility.support.RecordingDisarmer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ExitFlowTest {
    private val requested = ExitFlowState.Waiting(1_000_000)

    @Test
    fun asking_to_leave_starts_a_two_minute_wait() {
        assertEquals(ExitFlow.Transition(requested), ExitFlow.request(ExitFlowState.Armed, 1_000_000))
        assertEquals(120, ExitFlow.remainingSeconds(requested, 1_000_000))
    }

    @Test
    fun asking_again_never_restarts_the_wait() {
        assertEquals(requested, ExitFlow.request(requested, 1_060_000).state)
    }

    @Test
    fun protection_ends_once_the_wait_is_over_with_every_effect_in_order() {
        assertEquals(requested, ExitFlow.tick(requested, 1_119_999).state)

        val ended = ExitFlow.tick(requested, 1_120_000)

        assertEquals(ExitFlowState.Ended(1_120_000), ended.state)
        assertEquals(
            listOf(ExitFlowEffect.RECORD_PROTECTION_ENDED, ExitFlowEffect.DISARM_DEVICE_ADMIN, ExitFlowEffect.STOP_PROTECTION),
            ended.effects,
        )
    }

    @Test
    fun a_clock_set_back_restarts_the_wait_from_now_never_longer() {
        val rewound = ExitFlow.tick(requested, 900_000)

        assertEquals(ExitFlowState.Waiting(900_000), rewound.state)
        assertEquals(120, ExitFlow.remainingSeconds(rewound.state, 900_000))
    }

    @Test
    fun keeping_protection_cancels_the_wait() {
        assertEquals(ExitFlowState.Armed, ExitFlow.cancel(requested).state)
    }

    @Test
    fun turning_the_service_on_again_rearms_protection() {
        assertEquals(ExitFlowState.Armed, ExitFlow.rearm(ExitFlowState.Ended(5)).state)
        assertEquals(requested, ExitFlow.rearm(requested).state)
    }

    @Test
    fun the_controller_ends_protection_once_and_survives_a_failing_effect() {
        val store = MemoryExitFlowStore()
        val events = mutableListOf<String>()
        val failing =
            object : ProtectionDisarmer {
                override fun disarmDeviceAdmin(): Unit = error("device admin unavailable")

                override fun stopProtection() {
                    events += "stopped"
                }
            }
        val controller = ExitFlowController(store, BypassRecorder({ events += it.kind }) { "id" }, failing)

        controller.request(0)
        assertFalse(controller.tick(60_000))
        assertTrue(controller.tick(120_000))
        assertFalse("applied once", controller.tick(180_000))

        assertEquals(listOf("protection_ended", "stopped"), events)
        assertTrue(controller.protectionEnded)
        assertNull(controller.remainingSeconds(180_000))
    }

    @Test
    fun the_running_service_disarms_when_attached_otherwise_the_fallback_does() {
        val fallback = RecordingDisarmer()
        val service = RecordingDisarmer()
        val controller = ExitFlowController(MemoryExitFlowStore(), BypassRecorder({}) { "id" }, fallback)
        controller.disarmer = service

        controller.request(0)
        controller.tick(120_000)

        assertEquals(listOf("disarm_device_admin", "stop_protection"), service.calls)
        assertEquals(emptyList<String>(), fallback.calls)
    }
}
