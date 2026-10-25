// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.feature.onboarding.flow.BatteryGuidance
import dev.monkifocus.android.feature.onboarding.flow.OnboardingEffect
import dev.monkifocus.android.feature.onboarding.flow.OnboardingEvent
import dev.monkifocus.android.feature.onboarding.flow.OnboardingProgress
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStateMachine
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep
import dev.monkifocus.android.feature.onboarding.flow.RestrictedSettings
import dev.monkifocus.android.feature.onboarding.flow.SetupSnapshot
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** Each onboarding step, its denied state and the rule that nothing opens before the disclosure. */
@RunWith(RobolectricTestRunner::class)
class OnboardingScreenTest {
    @get:Rule
    val compose = createComposeRule()

    private val events = mutableListOf<OnboardingEvent>()
    private val effects = mutableListOf<OnboardingEffect>()

    /** Shows [start] and runs every event through the real state machine, as the app does. */
    private fun show(
        start: OnboardingProgress,
        snapshot: SetupSnapshot = SetupSnapshot.NOTHING,
        battery: BatteryGuidance = BatteryGuidance.GENERIC,
    ) {
        var progress by mutableStateOf(start)
        compose.setContent {
            MonkiTheme {
                OnboardingScreen(
                    progress = progress,
                    snapshot = snapshot,
                    battery = battery,
                    onEvent = { event ->
                        events += event
                        val transition = OnboardingStateMachine.reduce(progress, event, snapshot)
                        progress = transition.progress
                        transition.effect?.let { effects += it }
                    },
                    onOpenBatteryGuide = { events += OnboardingEvent.Act(OnboardingStep.BATTERY) },
                )
            }
        }
    }

    @Test
    fun welcome_says_what_monki_focus_is_and_is_not() {
        show(OnboardingProgress())

        compose.onNodeWithText("Welcome to monki-focus").assertIsDisplayed()
        compose.onNodeWithText("What it is not", substring = true).assertExists()
        compose.onNodeWithTag(OnboardingTestTags.BACK).assertDoesNotExist()
        compose.onNodeWithTag(OnboardingTestTags.NEXT).performClick()
        compose.onNodeWithTag(OnboardingTestTags.step(OnboardingStep.DISCLOSURE)).assertExists()
    }

    @Test
    fun the_disclosure_names_what_is_read_and_never_offers_next_before_agreeing() {
        show(OnboardingProgress(step = OnboardingStep.DISCLOSURE))

        compose.onNodeWithText("only the text of the address bar", substring = true).assertExists()
        compose.onNodeWithText("no internet permission", substring = true).assertExists()
        compose.onNodeWithTag(OnboardingTestTags.NEXT).assertDoesNotExist()
        compose.onNodeWithTag(OnboardingTestTags.AGREE).performScrollTo().performClick()

        compose.onNodeWithTag(OnboardingTestTags.step(OnboardingStep.NOTIFICATIONS)).assertExists()
        assertEquals(emptyList<OnboardingEffect>(), effects)
    }

    @Test
    @Config(qualifiers = "es")
    fun the_disclosure_reads_in_spanish() {
        show(OnboardingProgress(step = OnboardingStep.DISCLOSURE))

        compose.onNodeWithText("Cómo usa monki-focus la Accesibilidad").assertExists()
        compose.onNodeWithText("Acepto").assertExists()
    }

    @Test
    fun not_now_offers_statistics_only() {
        show(OnboardingProgress(step = OnboardingStep.DISCLOSURE))

        compose.onNodeWithTag(OnboardingTestTags.NOT_NOW).performScrollTo().performClick()
        compose.onNodeWithText("cannot block anything", substring = true).assertExists()
        compose.onNodeWithTag(OnboardingTestTags.STATS_ONLY).performScrollTo().performClick()

        compose.onNodeWithTag(OnboardingTestTags.step(OnboardingStep.USAGE_ACCESS)).assertExists()
    }

    @Test
    fun the_restricted_settings_step_leads_to_app_info() {
        show(
            OnboardingProgress(step = OnboardingStep.RESTRICTED_SETTINGS, disclosureAccepted = true),
            SetupSnapshot.NOTHING.copy(restrictedSettings = RestrictedSettings.RESTRICTED),
        )

        compose.onNodeWithText("Android reports that restricted settings are on", substring = true).assertExists()
        compose.onNodeWithText("Allow restricted settings").assertExists()
        compose.onNodeWithTag(OnboardingTestTags.ACTION).performScrollTo().performClick()

        assertEquals(listOf<OnboardingEffect>(OnboardingEffect.Open(OnboardingStep.RESTRICTED_SETTINGS)), effects)
    }

    @Test
    fun notifications_must_be_allowed_and_a_refusal_points_to_their_settings() {
        show(OnboardingProgress(step = OnboardingStep.NOTIFICATIONS, disclosureAccepted = true))

        compose.onNodeWithTag(OnboardingTestTags.NEXT).assertIsNotEnabled()
        compose.onNodeWithTag(OnboardingTestTags.ACTION).performScrollTo().performClick()

        assertEquals(listOf<OnboardingEffect>(OnboardingEffect.Open(OnboardingStep.NOTIFICATIONS)), effects)
        compose.onNodeWithText("Notifications are still off", substring = true).assertExists()
        compose.onNodeWithText("Open notification settings").assertExists()
    }

    @Test
    fun coming_back_without_the_service_shows_the_restricted_settings_help() {
        show(
            OnboardingProgress(
                step = OnboardingStep.ACCESSIBILITY,
                disclosureAccepted = true,
                attempted = setOf(OnboardingStep.ACCESSIBILITY),
            ),
            SetupSnapshot.NOTHING.copy(notifications = true, restrictedSettings = RestrictedSettings.PROBABLY_RESTRICTED),
        )

        compose.onNodeWithText("The service is still off", substring = true).assertExists()
        compose.onNodeWithTag(OnboardingTestTags.NEXT).assertIsNotEnabled()
        compose.onNodeWithTag(OnboardingTestTags.RESTRICTED_HELP).performScrollTo().performClick()

        assertEquals(listOf<OnboardingEffect>(OnboardingEffect.Open(OnboardingStep.RESTRICTED_SETTINGS)), effects)
    }

    @Test
    fun an_enabled_service_lets_the_user_go_on() {
        show(
            OnboardingProgress(step = OnboardingStep.ACCESSIBILITY, disclosureAccepted = true),
            SetupSnapshot.NOTHING.copy(notifications = true, accessibilityService = true),
        )

        compose.onNodeWithText("The service is on.").assertExists()
        compose.onNodeWithTag(OnboardingTestTags.ACTION).assertDoesNotExist()
        compose.onNodeWithTag(OnboardingTestTags.NEXT).assertIsEnabled().performClick()
        compose.onNodeWithTag(OnboardingTestTags.step(OnboardingStep.USAGE_ACCESS)).assertExists()
    }

    @Test
    fun optional_steps_offer_skip() {
        show(OnboardingProgress(step = OnboardingStep.BATTERY, disclosureAccepted = true), battery = BatteryGuidance.SAMSUNG)

        compose.onNodeWithText("Skip").assertIsEnabled()
        compose.onNodeWithText("Never sleeping apps", substring = true).assertExists()
        compose.onNodeWithTag(OnboardingTestTags.BATTERY_GUIDE).performScrollTo().performClick()
        compose.onNodeWithText("Skip").performClick()

        compose.onNodeWithTag(OnboardingTestTags.step(OnboardingStep.DEVICE_ADMIN)).assertExists()
    }

    @Test
    fun turning_on_is_disabled_while_something_required_is_missing() {
        show(OnboardingProgress(step = OnboardingStep.TURN_ON, disclosureAccepted = true), SetupSnapshot.NOTHING.copy(notifications = true))

        compose.onNodeWithTag(OnboardingTestTags.FINISH).performScrollTo().assertIsNotEnabled()
        compose.onNodeWithTag(OnboardingTestTags.fix(OnboardingStep.ACCESSIBILITY)).performScrollTo().performClick()

        compose.onNodeWithTag(OnboardingTestTags.step(OnboardingStep.ACCESSIBILITY)).assertExists()
        assertEquals(emptyList<OnboardingEffect>(), effects)
    }

    @Test
    fun turning_on_arms_once_everything_required_is_done() {
        show(
            OnboardingProgress(step = OnboardingStep.TURN_ON, disclosureAccepted = true),
            SetupSnapshot.NOTHING.copy(notifications = true, accessibilityService = true),
        )

        compose
            .onNodeWithTag(OnboardingTestTags.FINISH)
            .performScrollTo()
            .assertIsEnabled()
            .performClick()

        assertEquals(listOf<OnboardingEffect>(OnboardingEffect.Arm), effects)
    }
}
