// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import dev.monkifocus.android.core.domain.rules.FrictionType
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.theme.LocalReducedMotion
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class PausingScreenTest {
    @get:Rule
    val compose = createComposeRule()

    private val politeLiveRegion = SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, LiveRegionMode.Polite)

    @Test
    fun close_is_enabled_from_the_first_frame() {
        var closes = 0
        compose.mainClock.autoAdvance = false
        compose.setContent {
            MonkiTheme { GateScreen(pausing(remainingSeconds = 15), GateActions(onClose = { closes++ })) }
        }

        compose.onNodeWithTag(GateTestTags.CLOSE).assertIsEnabled()

        compose.mainClock.autoAdvance = true
        compose.onNodeWithTag(GateTestTags.CLOSE).performScrollTo().performClick()
        assertEquals(1, closes)
    }

    @Test
    fun the_countdown_is_a_polite_live_region_announced_every_five_seconds() {
        var remaining by mutableIntStateOf(12)
        compose.setContent {
            MonkiTheme { PausingScreen(pausing(remainingSeconds = remaining), onClose = {}, onEmergency = {}) }
        }
        val countdown = compose.onNodeWithTag(GateTestTags.COUNTDOWN)

        countdown.assert(politeLiveRegion).assertContentDescriptionEquals("Seconds left: 12")

        remaining = 11
        compose.waitForIdle()
        countdown.assertContentDescriptionEquals("Seconds left: 12")

        remaining = 10
        compose.waitForIdle()
        countdown.assertContentDescriptionEquals("Seconds left: 10")
    }

    @Test
    fun the_countdown_shows_the_seconds_left_with_the_why_line() {
        compose.setContent {
            MonkiTheme { PausingScreen(pausing(remainingSeconds = 9), onClose = {}, onEmergency = {}) }
        }

        compose.onNodeWithText("A short pause before you decide.").assertExists()
        compose.onNodeWithText("Level 1 of 3").assertExists()
    }

    @Test
    fun the_breath_pause_alternates_its_label_with_the_elapsed_time() {
        var remaining by mutableIntStateOf(15)
        compose.setContent {
            MonkiTheme {
                PausingScreen(pausing(remainingSeconds = remaining, frictionType = FrictionType.BREATH), onClose = {}, onEmergency = {})
            }
        }

        compose.onNodeWithTag(GateTestTags.BREATH).assert(politeLiveRegion)
        compose.onNodeWithText("Breathe in").assertExists()

        remaining = 11
        compose.waitForIdle()
        compose.onNodeWithText("Breathe out").assertExists()
    }

    @Test
    fun the_breath_pause_renders_under_reduced_motion() {
        compose.setContent {
            MonkiTheme {
                CompositionLocalProvider(LocalReducedMotion provides true) {
                    PausingScreen(pausing(remainingSeconds = 10, frictionType = FrictionType.BREATH), onClose = {}, onEmergency = {})
                }
            }
        }

        compose.onNodeWithText("Breathe out").assertExists()
        compose.onNodeWithTag(GateTestTags.CLOSE).assertIsEnabled()
    }

    @Test
    fun emergency_access_is_offered_during_the_pause() {
        var emergencies = 0
        compose.setContent {
            MonkiTheme { GateScreen(pausing(), GateActions(onClose = {}, onEmergency = { emergencies++ })) }
        }

        compose.onNodeWithTag(GateTestTags.EMERGENCY).performScrollTo().performClick()

        assertEquals(1, emergencies)
    }
}
