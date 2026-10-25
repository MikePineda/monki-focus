// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import dev.monkifocus.android.service.accessibility.bypass.BypassJournalCodec
import dev.monkifocus.android.service.accessibility.exit.ExitFlowState
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/** Device admin is friction only; turning it off outside the exit flow is a recorded bypass. */
@RunWith(RobolectricTestRunner::class)
class MonkiDeviceAdminReceiverTest {
    private val application = ApplicationProvider.getApplicationContext<MonkiApplication>()
    private val protection get() = application.graph.protection

    /** The journal is written synchronously, before the asynchronous Room outbox. */
    private fun journalledKinds(): List<String> = protection.preferences.journal().mapNotNull { BypassJournalCodec.decode(it)?.kind }

    @Test
    fun the_deactivation_prompt_explains_the_bypass_and_the_way_out() {
        val text = MonkiDeviceAdminReceiver().onDisableRequested(application, Intent())

        assertTrue(text.isNotBlank())
    }

    @Test
    fun turning_device_admin_off_in_settings_is_recorded_as_a_bypass() {
        MonkiDeviceAdminReceiver().onDisabled(application, Intent())

        assertEquals(listOf("device_admin_disabled"), recordedKinds())
    }

    @Test
    fun the_exit_flow_removing_device_admin_is_not_a_bypass() {
        protection.preferences.save(ExitFlowState.Ended(1_000))

        MonkiDeviceAdminReceiver().onDisabled(application, Intent())

        assertEquals(emptyList<String>(), journalledKinds())
    }

    /** Kinds in the Room outbox or still in the journal (the outbox write is asynchronous). */
    private fun recordedKinds(): List<String> {
        val deadline = System.currentTimeMillis() + 5_000
        while (System.currentTimeMillis() < deadline) {
            val stored =
                runBlocking {
                    application.graph.data.bypassEvents
                        .unreported(10)
                }.map { it.kind }
            val kinds = (stored + journalledKinds()).distinct()
            if (kinds.isNotEmpty()) return kinds
            Thread.sleep(20)
        }
        return emptyList()
    }
}
