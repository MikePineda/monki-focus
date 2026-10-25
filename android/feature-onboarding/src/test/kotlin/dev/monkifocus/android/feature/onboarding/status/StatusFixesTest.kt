// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.status

import dev.monkifocus.android.feature.onboarding.flow.OnboardingEffect
import dev.monkifocus.android.feature.onboarding.flow.OnboardingEvent
import dev.monkifocus.android.feature.onboarding.flow.OnboardingMode
import dev.monkifocus.android.feature.onboarding.flow.OnboardingProgress
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStateMachine
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep
import dev.monkifocus.android.feature.onboarding.flow.RestrictedSettings
import dev.monkifocus.android.feature.onboarding.flow.SetupSnapshot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Status fix buttons follow the onboarding rules; the checklist fits the mode the user chose. */
class StatusFixesTest {
    private val statsOnly =
        OnboardingProgress(step = OnboardingStep.TURN_ON, disclosureDeclined = true, mode = OnboardingMode.STATS_ONLY, completed = true)
    private val protected = OnboardingProgress(step = OnboardingStep.TURN_ON, disclosureAccepted = true, completed = true)

    private fun fix(
        progress: OnboardingProgress,
        step: OnboardingStep,
    ) = OnboardingStateMachine.reduce(progress, OnboardingEvent.Act(step), SetupSnapshot.NOTHING).effect

    @Test
    fun a_fix_button_opens_only_what_onboarding_would_open() {
        assertEquals(OnboardingEffect.Open(OnboardingStep.ACCESSIBILITY), fix(protected, OnboardingStep.ACCESSIBILITY))
        assertNull("no disclosure accepted", fix(OnboardingProgress(completed = true), OnboardingStep.ACCESSIBILITY))
        assertNull(fix(statsOnly, OnboardingStep.ACCESSIBILITY))
        assertNull(fix(statsOnly, OnboardingStep.DEVICE_ADMIN))
        assertEquals(OnboardingEffect.Open(OnboardingStep.USAGE_ACCESS), fix(statsOnly, OnboardingStep.USAGE_ACCESS))
        assertEquals(OnboardingEffect.Open(OnboardingStep.NOTIFICATIONS), fix(statsOnly, OnboardingStep.NOTIFICATIONS))
    }

    @Test
    fun statistics_only_hides_battery_and_uninstall_protection() {
        val steps = StatusChecklist.of(SetupSnapshot.NOTHING, protectionWanted = false).map { it.step }.toSet()

        assertEquals(setOf(OnboardingStep.NOTIFICATIONS, OnboardingStep.ACCESSIBILITY, OnboardingStep.USAGE_ACCESS), steps)
    }

    @Test
    fun protection_is_wanted_once_armed_whatever_the_mode() {
        assertTrue(StatusChecklist.protectionWanted(armedByUser = true, mode = OnboardingMode.STATS_ONLY))
        assertTrue(StatusChecklist.protectionWanted(armedByUser = false, mode = OnboardingMode.PROTECTION))
        assertFalse(StatusChecklist.protectionWanted(armedByUser = false, mode = OnboardingMode.STATS_ONLY))
    }

    @Test
    fun restricted_settings_get_an_app_info_item_while_they_may_block_the_switch() {
        val blocked = SetupSnapshot.NOTHING.copy(restrictedSettings = RestrictedSettings.PROBABLY_RESTRICTED)

        val entries = StatusChecklist.of(blocked, protectionWanted = true)
        val restricted = entries.single { it.step == OnboardingStep.RESTRICTED_SETTINGS }

        assertFalse(restricted.granted)
        assertEquals(OnboardingEffect.Open(OnboardingStep.RESTRICTED_SETTINGS), fix(protected, OnboardingStep.RESTRICTED_SETTINGS))
        val on = blocked.copy(accessibilityService = true)
        assertTrue(StatusChecklist.of(on, protectionWanted = true).none { it.step == OnboardingStep.RESTRICTED_SETTINGS })
        assertTrue(StatusChecklist.of(blocked, protectionWanted = false).none { it.step == OnboardingStep.RESTRICTED_SETTINGS })
        assertTrue(
            StatusChecklist
                .of(SetupSnapshot.NOTHING.copy(restrictedSettings = RestrictedSettings.ALLOWED), protectionWanted = true)
                .none { it.step == OnboardingStep.RESTRICTED_SETTINGS },
        )
    }

    @Test
    fun an_armed_user_who_has_not_accepted_this_disclosure_sees_it_again_without_disarming() {
        val older = OnboardingProgress(step = OnboardingStep.DISCLOSURE, completed = false)

        assertTrue(OnboardingStateMachine.needsReconsent(older, armedByUser = true))
        assertFalse(OnboardingStateMachine.needsReconsent(older, armedByUser = false))
        assertFalse(OnboardingStateMachine.needsReconsent(protected, armedByUser = true))

        val agreed = OnboardingStateMachine.reconsented(older)
        assertTrue(agreed.disclosureAccepted)
        assertTrue(agreed.completed)
        assertEquals(OnboardingMode.PROTECTION, agreed.mode)
        assertFalse(OnboardingStateMachine.needsReconsent(agreed, armedByUser = true))
    }
}
