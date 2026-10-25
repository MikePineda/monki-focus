// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import androidx.test.core.app.ApplicationProvider
import dev.monkifocus.android.feature.gate.state.GateUiState
import dev.monkifocus.android.service.accessibility.action.OverlayContent
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** The keyboard fallback reports when it is really on screen and resets the relay when it leaves. */
@RunWith(RobolectricTestRunner::class)
@Config(application = TestProtectionApplication::class)
class GateActivityTest {
    private val relay = ApplicationProvider.getApplicationContext<TestProtectionApplication>().protectionGraph.gateRelay
    private val prompt =
        OverlayContent.Gate(
            GateUiState.Asking("app", level = 2, requiresTypedIntention = true, requiresGuardianKey = false),
            group = "rule-1",
        )

    @Test
    fun the_activity_on_screen_counts_as_the_gate_being_shown() {
        relay.post(prompt)

        Robolectric
            .buildActivity(GateActivity::class.java)
            .create()
            .start()
            .resume()

        assertTrue(relay.activityVisible)
    }

    @Test
    fun leaving_the_activity_resets_the_relay_so_the_gate_is_launched_again() {
        relay.post(prompt)
        val activity =
            Robolectric
                .buildActivity(GateActivity::class.java)
                .create()
                .start()
                .resume()

        activity.pause().stop()

        assertFalse(relay.activityVisible)
        assertNull(relay.content.value)
    }
}
