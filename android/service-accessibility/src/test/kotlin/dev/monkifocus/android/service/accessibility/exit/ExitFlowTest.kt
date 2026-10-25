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
    private fun at(
        mono: Long,
        boot: Int = 1,
        wall: Long = 5_000_000 + mono,
    ) = ExitTime(mono, boot, wall)

    private val requested = ExitFlowState.Waiting(1_000_000, boot = 1)

    @Test
    fun asking_to_leave_starts_a_two_minute_wait_on_the_monotonic_clock() {
        assertEquals(ExitFlow.Transition(requested), ExitFlow.request(ExitFlowState.Armed, at(1_000_000)))
        assertEquals(120, ExitFlow.remainingSeconds(requested, at(1_000_000)))
    }

    @Test
    fun asking_again_never_restarts_the_wait() {
        assertEquals(requested, ExitFlow.request(requested, at(1_060_000)).state)
    }

    @Test
    fun protection_ends_once_the_wait_is_over_with_every_effect_in_order() {
        assertEquals(requested, ExitFlow.tick(requested, at(1_119_999)).state)

        val ended = ExitFlow.tick(requested, at(1_120_000))

        assertEquals(ExitFlowState.Ended(at(1_120_000).wallMs), ended.state)
        assertEquals(
            listOf(ExitFlowEffect.RECORD_PROTECTION_ENDED, ExitFlowEffect.DISARM_DEVICE_ADMIN, ExitFlowEffect.STOP_PROTECTION),
            ended.effects,
        )
    }

    @Test
    fun setting_the_wall_clock_forward_does_not_shorten_the_wait() {
        val tick = ExitFlow.tick(requested, at(1_010_000, wall = Long.MAX_VALUE / 2))

        assertEquals(requested, tick.state)
        assertEquals(110, ExitFlow.remainingSeconds(requested, at(1_010_000, wall = Long.MAX_VALUE / 2)))
    }

    @Test
    fun a_reboot_restarts_the_wait() {
        val afterReboot = ExitFlow.tick(requested, at(9_000_000, boot = 2))

        assertEquals(ExitFlowState.Waiting(9_000_000, boot = 2), afterReboot.state)
        assertEquals(120, ExitFlow.remainingSeconds(afterReboot.state, at(9_000_000, boot = 2)))
    }

    @Test
    fun keeping_protection_cancels_the_wait() {
        assertEquals(ExitFlowState.Armed, ExitFlow.cancel(requested).state)
    }

    @Test
    fun an_ended_protection_turns_the_service_off_again_when_it_is_turned_on() {
        val (transition, start) = ExitFlow.connect(ExitFlowState.Ended(5))

        assertEquals(ServiceStart.DISABLE, start)
        assertEquals(ExitFlowState.Ended(5), transition.state)
    }

    @Test
    fun only_a_re_arm_asked_for_in_our_app_brings_protection_back() {
        val allowed = ExitFlow.allowRearm(ExitFlowState.Ended(5)).state

        val (transition, start) = ExitFlow.connect(allowed)

        assertEquals(ServiceStart.RUN, start)
        assertEquals(ExitFlowState.Armed, transition.state)
        assertEquals("nothing to re-arm while armed", ExitFlowState.Armed, ExitFlow.allowRearm(ExitFlowState.Armed).state)
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
        var mono = 0L
        val controller = ExitFlowController(store, BypassRecorder({ events += it.kind }) { "id" }, failing) { at(mono) }

        controller.request()
        mono = 60_000
        assertFalse(controller.tick())
        mono = 120_000
        assertTrue(controller.tick())
        mono = 180_000
        assertFalse("applied once", controller.tick())

        assertEquals(listOf("protection_ended", "stopped"), events)
        assertTrue(controller.protectionEnded)
        assertNull(controller.remainingSeconds())
        assertEquals(ServiceStart.DISABLE, controller.connect())
    }

    @Test
    fun the_running_service_disarms_when_attached_otherwise_the_fallback_does() {
        val fallback = RecordingDisarmer()
        val service = RecordingDisarmer()
        var mono = 0L
        val controller = ExitFlowController(MemoryExitFlowStore(), BypassRecorder({}) { "id" }, fallback) { at(mono) }
        controller.disarmer = service

        controller.request()
        mono = 120_000
        controller.tick()

        assertEquals(listOf("disarm_device_admin", "stop_protection"), service.calls)
        assertEquals(emptyList<String>(), fallback.calls)
    }
}
