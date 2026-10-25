// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.ui

import androidx.compose.material3.Text
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep
import dev.monkifocus.android.feature.onboarding.flow.RestrictedSettings
import dev.monkifocus.android.feature.onboarding.flow.SetupSnapshot
import dev.monkifocus.android.feature.onboarding.status.ActiveRulesSummary
import dev.monkifocus.android.feature.onboarding.status.ProtectionState
import dev.monkifocus.android.feature.onboarding.status.StatusChecklist
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class StatusScreenTest {
    @get:Rule
    val compose = createComposeRule()

    private val calls = mutableListOf<String>()

    private fun show(
        protection: ProtectionState,
        snapshot: SetupSnapshot,
        rules: ActiveRulesSummary? = null,
        rulesUnavailable: Boolean = false,
    ) {
        val status =
            StatusUi(protection, StatusChecklist.of(snapshot, protectionWanted = true), rules, snapshot.notifications, rulesUnavailable)
        compose.setContent {
            MonkiTheme {
                StatusScreen(
                    status = status,
                    onFix = { calls += "fix:${it.name}" },
                    onRequestNotice = { calls += "notice" },
                    onTurnOn = { calls += "turn_on" },
                    onEditRules = { calls += "rules" },
                    onExitAndUnlink = { calls += "exit" },
                    banner = { Text("banner slot") },
                )
            }
        }
    }

    @Test
    fun active_protection_shows_its_state_and_always_offers_exit() {
        show(ProtectionState.ACTIVE, SetupSnapshot.NOTHING.copy(notifications = true, accessibilityService = true))

        compose.onNodeWithText("Protection is on").assertIsDisplayed()
        compose.onNodeWithText("banner slot").assertIsDisplayed()
        compose.onNodeWithTag(StatusTestTags.TURN_ON).assertDoesNotExist()
        compose.onNodeWithTag(StatusTestTags.EXIT).performScrollTo().performClick()
        compose.onNodeWithTag(StatusTestTags.EDIT_RULES).performScrollTo().performClick()

        assertEquals(listOf("exit", "rules"), calls)
    }

    @Test
    fun a_missing_required_permission_is_on_top_with_its_fix_button() {
        show(ProtectionState.SERVICE_OFF, SetupSnapshot.NOTHING.copy(notifications = true))

        compose.onNodeWithText("Off, required").assertExists()
        compose.onNodeWithTag(StatusTestTags.fix(OnboardingStep.ACCESSIBILITY)).performScrollTo().performClick()
        compose.onNodeWithTag(StatusTestTags.fix(OnboardingStep.NOTIFICATIONS)).assertDoesNotExist()
        compose.onNodeWithTag(StatusTestTags.TURN_ON).performScrollTo().performClick()

        assertEquals(listOf("fix:ACCESSIBILITY", "turn_on"), calls)
    }

    @Test
    fun without_the_notice_the_status_says_so_and_offers_to_ask() {
        show(ProtectionState.ACTIVE, SetupSnapshot.NOTHING.copy(accessibilityService = true))

        compose.onNodeWithText("Protection notice: off").assertExists()
        compose.onNodeWithTag(StatusTestTags.REQUEST_NOTICE).performScrollTo().performClick()

        assertEquals(listOf("notice"), calls)
    }

    @Test
    fun the_rules_in_force_are_summarised() {
        show(
            ProtectionState.ACTIVE,
            SetupSnapshot.NOTHING.copy(notifications = true, accessibilityService = true),
            ActiveRulesSummary(enabledRules = 9, bedtimeStart = "22:30", bedtimeEnd = "07:00", pendingFrom = "2026-10-27T22:00:00Z"),
        )

        compose.onNodeWithText("Rules on: 9").performScrollTo().assertExists()
        compose.onNodeWithText("Bedtime", substring = true).assertExists()
        compose.onNodeWithText("A change waits until", substring = true).assertExists()
    }

    @Test
    fun unreadable_rules_are_said_and_exit_still_works() {
        show(ProtectionState.ACTIVE, SetupSnapshot.NOTHING.copy(notifications = true, accessibilityService = true), rulesUnavailable = true)

        compose.onNodeWithTag(StatusTestTags.RULES_UNAVAILABLE).performScrollTo().assertExists()
        compose.onNodeWithTag(StatusTestTags.RULES).assertDoesNotExist()
        compose.onNodeWithTag(StatusTestTags.EXIT).performScrollTo().performClick()

        assertEquals(listOf("exit"), calls)
    }

    @Test
    fun restricted_settings_get_their_own_fix_while_they_may_block_the_switch() {
        show(
            ProtectionState.SERVICE_OFF,
            SetupSnapshot.NOTHING.copy(notifications = true, restrictedSettings = RestrictedSettings.PROBABLY_RESTRICTED),
        )

        compose.onNodeWithTag(StatusTestTags.fix(OnboardingStep.RESTRICTED_SETTINGS)).performScrollTo().performClick()

        assertEquals(listOf("fix:RESTRICTED_SETTINGS"), calls)
    }
}
