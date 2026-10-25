// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.flow

import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep.ACCESSIBILITY
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep.BATTERY
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep.DEVICE_ADMIN
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep.DISCLOSURE
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep.NOTIFICATIONS
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep.RESTRICTED_SETTINGS
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep.TURN_ON
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep.USAGE_ACCESS
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep.WELCOME
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OnboardingStateMachineTest {
    private val machine = OnboardingStateMachine
    private val nothing = SetupSnapshot.NOTHING
    private val required = nothing.copy(notifications = true, accessibilityService = true)
    private val accepted = OnboardingProgress(step = NOTIFICATIONS, disclosureAccepted = true)

    private fun OnboardingProgress.after(
        event: OnboardingEvent,
        snapshot: SetupSnapshot = nothing,
    ) = machine.reduce(this, event, snapshot)

    @Test
    fun welcome_leads_to_the_disclosure() {
        assertEquals(DISCLOSURE, OnboardingProgress().after(OnboardingEvent.Next).progress.step)
    }

    @Test
    fun the_disclosure_must_be_accepted_before_moving_on() {
        val atDisclosure = OnboardingProgress(step = DISCLOSURE)

        assertEquals(DISCLOSURE, atDisclosure.after(OnboardingEvent.Next).progress.step)
        val agreed = atDisclosure.after(OnboardingEvent.AcceptDisclosure).progress
        assertTrue(agreed.disclosureAccepted)
        assertEquals(NOTIFICATIONS, agreed.step)
    }

    @Test
    fun no_system_screen_opens_before_the_disclosure_is_accepted() {
        val notAccepted = OnboardingProgress(step = ACCESSIBILITY)

        OnboardingStep.entries.forEach { step -> assertNull(step.name, notAccepted.after(OnboardingEvent.Act(step)).effect) }
        assertEquals(
            OnboardingEffect.Open(ACCESSIBILITY),
            accepted.copy(step = ACCESSIBILITY).after(OnboardingEvent.Act(ACCESSIBILITY)).effect,
        )
    }

    @Test
    fun the_restricted_settings_step_shows_only_where_android_may_block_the_switch() {
        val progress = OnboardingProgress(disclosureAccepted = true)

        fun path(
            restricted: RestrictedSettings,
            enabled: Boolean = false,
        ) = machine.path(progress, nothing.copy(restrictedSettings = restricted, accessibilityService = enabled))

        assertTrue(RESTRICTED_SETTINGS in path(RestrictedSettings.PROBABLY_RESTRICTED))
        assertTrue(RESTRICTED_SETTINGS in path(RestrictedSettings.RESTRICTED))
        assertFalse(RESTRICTED_SETTINGS in path(RestrictedSettings.NOT_APPLICABLE))
        assertFalse(RESTRICTED_SETTINGS in path(RestrictedSettings.PROBABLY_ALLOWED))
        assertFalse(RESTRICTED_SETTINGS in path(RestrictedSettings.ALLOWED))
        assertFalse("already on: nothing to unblock", RESTRICTED_SETTINGS in path(RestrictedSettings.RESTRICTED, enabled = true))
        assertEquals(
            listOf(WELCOME, DISCLOSURE, RESTRICTED_SETTINGS, NOTIFICATIONS, ACCESSIBILITY, USAGE_ACCESS, BATTERY, DEVICE_ADMIN, TURN_ON),
            path(RestrictedSettings.RESTRICTED),
        )
    }

    @Test
    fun leaving_the_restricted_settings_step_never_needs_it_resolved() {
        val snapshot = nothing.copy(restrictedSettings = RestrictedSettings.RESTRICTED)
        val atRestricted = accepted.copy(step = RESTRICTED_SETTINGS)

        assertEquals(NOTIFICATIONS, atRestricted.after(OnboardingEvent.Next, snapshot).progress.step)
        assertEquals(
            OnboardingEffect.Open(RESTRICTED_SETTINGS),
            atRestricted.after(OnboardingEvent.Act(RESTRICTED_SETTINGS), snapshot).effect,
        )
    }

    @Test
    fun notifications_are_required_and_show_denied_after_a_refusal() {
        assertEquals(NOTIFICATIONS, accepted.after(OnboardingEvent.Next).progress.step)
        val asked = accepted.after(OnboardingEvent.Act(NOTIFICATIONS))

        assertEquals(OnboardingEffect.Open(NOTIFICATIONS), asked.effect)
        assertEquals(StepStatus.DENIED, machine.status(NOTIFICATIONS, asked.progress, nothing))
        assertEquals(StepStatus.DONE, machine.status(NOTIFICATIONS, asked.progress, nothing.copy(notifications = true)))
        assertEquals(
            ACCESSIBILITY,
            asked.progress
                .after(OnboardingEvent.Next, nothing.copy(notifications = true))
                .progress.step,
        )
    }

    @Test
    fun the_accessibility_service_is_required_and_coming_back_without_it_is_denied() {
        val atAccessibility = accepted.copy(step = ACCESSIBILITY)
        val granted = nothing.copy(notifications = true)

        assertEquals(StepStatus.TO_DO, machine.status(ACCESSIBILITY, atAccessibility, granted))
        assertEquals(ACCESSIBILITY, atAccessibility.after(OnboardingEvent.Next, granted).progress.step)
        val opened = atAccessibility.after(OnboardingEvent.Act(ACCESSIBILITY), granted).progress
        assertEquals(StepStatus.DENIED, machine.status(ACCESSIBILITY, opened, granted))
        assertEquals(USAGE_ACCESS, opened.after(OnboardingEvent.Next, required).progress.step)
    }

    @Test
    fun optional_steps_can_be_skipped() {
        val atUsage = accepted.copy(step = USAGE_ACCESS)

        val atBattery = atUsage.after(OnboardingEvent.Next, required).progress
        val atAdmin = atBattery.after(OnboardingEvent.Next, required).progress
        val atEnd = atAdmin.after(OnboardingEvent.Next, required).progress

        assertEquals(listOf(BATTERY, DEVICE_ADMIN, TURN_ON), listOf(atBattery.step, atAdmin.step, atEnd.step))
        assertFalse(machine.isRequired(USAGE_ACCESS, OnboardingMode.PROTECTION))
        assertTrue(machine.isRequired(ACCESSIBILITY, OnboardingMode.PROTECTION))
    }

    @Test
    fun turning_protection_on_arms_only_once_every_required_step_is_done() {
        val atEnd = accepted.copy(step = TURN_ON)

        assertNull(atEnd.after(OnboardingEvent.Finish, nothing.copy(notifications = true)).effect)
        assertFalse(atEnd.after(OnboardingEvent.Finish, nothing.copy(notifications = true)).progress.completed)
        assertEquals(listOf(ACCESSIBILITY), machine.missing(atEnd, nothing.copy(notifications = true)))

        val armed = atEnd.after(OnboardingEvent.Finish, required)
        assertEquals(OnboardingEffect.Arm, armed.effect)
        assertTrue(armed.progress.completed)
    }

    @Test
    fun arming_needs_the_disclosure_even_with_every_permission_granted() {
        val notAccepted = OnboardingProgress(step = TURN_ON)

        assertNull(notAccepted.after(OnboardingEvent.Finish, required).effect)
        assertEquals(listOf(DISCLOSURE), machine.missing(notAccepted, required))
    }

    @Test
    fun a_fix_link_reaches_a_missing_step_but_never_skips_the_disclosure() {
        val atEnd = accepted.copy(step = TURN_ON)

        assertEquals(ACCESSIBILITY, atEnd.after(OnboardingEvent.GoTo(ACCESSIBILITY)).progress.step)
        assertEquals(DISCLOSURE, OnboardingProgress().after(OnboardingEvent.GoTo(ACCESSIBILITY)).progress.step)
    }

    @Test
    fun back_goes_to_the_previous_step_and_stops_at_welcome() {
        assertEquals(DISCLOSURE, accepted.after(OnboardingEvent.Back).progress.step)
        assertEquals(WELCOME, OnboardingProgress().after(OnboardingEvent.Back).progress.step)
    }

    @Test
    fun declining_the_disclosure_offers_statistics_only_and_never_arms() {
        val declined = OnboardingProgress(step = DISCLOSURE).after(OnboardingEvent.DeclineDisclosure).progress
        assertTrue(declined.disclosureDeclined)
        assertEquals(StepStatus.DENIED, machine.status(DISCLOSURE, declined, nothing))

        val statsOnly = declined.after(OnboardingEvent.ContinueStatsOnly).progress
        assertEquals(OnboardingMode.STATS_ONLY, statsOnly.mode)
        assertEquals(USAGE_ACCESS, statsOnly.step)
        assertEquals(listOf(WELCOME, DISCLOSURE, USAGE_ACCESS, TURN_ON), machine.path(statsOnly, nothing))
        assertEquals(OnboardingEffect.Open(USAGE_ACCESS), statsOnly.after(OnboardingEvent.Act(USAGE_ACCESS)).effect)
        assertNull(statsOnly.after(OnboardingEvent.Act(ACCESSIBILITY)).effect)

        val finished = statsOnly.copy(step = TURN_ON).after(OnboardingEvent.Finish, required)
        assertEquals(OnboardingEffect.FinishStatsOnly, finished.effect)
        assertTrue(finished.progress.completed)
    }

    @Test
    fun accepting_after_declining_returns_to_the_protection_path() {
        val declined = OnboardingProgress(step = DISCLOSURE, disclosureDeclined = true, mode = OnboardingMode.STATS_ONLY)

        val agreed = declined.after(OnboardingEvent.AcceptDisclosure).progress

        assertEquals(OnboardingMode.PROTECTION, agreed.mode)
        assertFalse(agreed.disclosureDeclined)
        assertEquals(NOTIFICATIONS, agreed.step)
    }

    @Test
    fun turning_protection_on_again_resumes_at_the_first_missing_required_step() {
        val done = OnboardingProgress(step = TURN_ON, disclosureAccepted = true, completed = true, attempted = setOf(ACCESSIBILITY))

        val again = machine.restart(done, nothing.copy(notifications = true))

        assertFalse(again.completed)
        assertEquals(ACCESSIBILITY, again.step)
        assertEquals(emptySet<OnboardingStep>(), again.attempted)
        assertEquals(TURN_ON, machine.restart(done, required).step)
        assertEquals(DISCLOSURE, machine.restart(OnboardingProgress(completed = true, mode = OnboardingMode.STATS_ONLY), required).step)
        assertEquals(OnboardingMode.PROTECTION, machine.restart(OnboardingProgress(mode = OnboardingMode.STATS_ONLY), required).mode)
    }

    @Test
    fun every_step_is_done_or_waiting_for_the_user() {
        val all =
            nothing.copy(
                usageAccess = true,
                batteryUnrestricted = true,
                deviceAdmin = true,
                notifications = true,
                accessibilityService = true,
            )

        listOf(USAGE_ACCESS, BATTERY, DEVICE_ADMIN).forEach { step ->
            assertEquals(StepStatus.TO_DO, machine.status(step, accepted, nothing))
            assertEquals(StepStatus.DENIED, machine.status(step, accepted.copy(attempted = setOf(step)), nothing))
            assertEquals(StepStatus.DONE, machine.status(step, accepted, all))
        }
        assertEquals(StepStatus.DONE, machine.status(WELCOME, OnboardingProgress(), nothing))
        assertEquals(
            StepStatus.DONE,
            machine.status(RESTRICTED_SETTINGS, accepted, nothing.copy(restrictedSettings = RestrictedSettings.ALLOWED)),
        )
        assertEquals(StepStatus.TO_DO, machine.status(TURN_ON, accepted, all))
    }
}
