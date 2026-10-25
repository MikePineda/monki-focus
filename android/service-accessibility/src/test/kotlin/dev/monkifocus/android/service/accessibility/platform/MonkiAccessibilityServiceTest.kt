// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import dev.monkifocus.android.service.accessibility.bypass.BypassJournalCodec
import dev.monkifocus.android.service.accessibility.exit.ExitFlowState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** Wiring of the service with the real protection graph (Robolectric: no screen is ever read here). */
@RunWith(RobolectricTestRunner::class)
@Config(application = TestProtectionApplication::class)
class MonkiAccessibilityServiceTest {
    private val application = ApplicationProvider.getApplicationContext<TestProtectionApplication>()
    private val graph get() = application.protectionGraph

    private fun connected(): MonkiAccessibilityService =
        Robolectric
            .buildService(MonkiAccessibilityService::class.java)
            .create()
            .get()
            .also { it.onServiceConnected() }

    /** Kinds in the outbox or still in the journal (the outbox write is asynchronous). */
    private fun recordedKinds(): List<String> {
        val deadline = System.currentTimeMillis() + 5_000
        while (System.currentTimeMillis() < deadline) {
            val kinds =
                application.outbox.events.map { it.kind } + graph.preferences.journal().mapNotNull { BypassJournalCodec.decode(it)?.kind }
            if (kinds.isNotEmpty()) return kinds.distinct()
            Thread.sleep(20)
        }
        return emptyList()
    }

    @Test
    fun the_service_binds_and_puts_up_the_protection_notice() {
        connected()

        assertEquals(true, application.notices.last())
        assertTrue("the gate activity can reach the service", graph.gateRelay.onAction != null)
    }

    @Test
    fun unbinding_records_accessibility_disabled_and_takes_the_notice_down() {
        val service = connected()

        service.onUnbind(Intent())

        assertEquals(listOf("accessibility_disabled"), recordedKinds())
        assertEquals(false, application.notices.last())
    }

    @Test
    fun turning_the_service_on_again_after_an_exit_rearms_protection() {
        graph.preferences.save(ExitFlowState.Ended(1_000))

        connected()

        assertEquals(ExitFlowState.Armed, graph.exitFlow.state)
    }

    @Test
    fun an_unbind_after_a_deliberate_exit_is_not_a_bypass() {
        val service = connected()
        graph.preferences.save(ExitFlowState.Ended(1_000))

        service.onUnbind(Intent())
        Thread.sleep(200)

        assertEquals(emptyList<String>(), application.outbox.events.map { it.kind })
        assertEquals(emptySet<String>(), graph.preferences.journal())
    }
}
