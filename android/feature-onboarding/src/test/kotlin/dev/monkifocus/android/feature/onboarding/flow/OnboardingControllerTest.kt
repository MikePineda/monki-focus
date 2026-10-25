// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.flow

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OnboardingControllerTest {
    private class MemoryStore(
        var stored: OnboardingProgress = OnboardingProgress(),
    ) : OnboardingStore {
        var saves = 0

        override fun load(): OnboardingProgress = stored

        override fun save(progress: OnboardingProgress) {
            stored = progress
            saves += 1
        }
    }

    private val ready = SetupSnapshot.NOTHING.copy(notifications = true, accessibilityService = true)

    @Test
    fun onboarding_resumes_where_it_was_left() {
        val store = MemoryStore()
        OnboardingController(store).apply {
            handle(OnboardingEvent.Next, ready)
            handle(OnboardingEvent.AcceptDisclosure, ready)
        }

        val resumed = OnboardingController(store)

        assertEquals(OnboardingStep.NOTIFICATIONS, resumed.progress.step)
        assertTrue(resumed.progress.disclosureAccepted)
    }

    @Test
    fun the_step_is_saved_before_its_system_screen_opens() {
        val store = MemoryStore(OnboardingProgress(step = OnboardingStep.ACCESSIBILITY, disclosureAccepted = true))

        val effect = OnboardingController(store).handle(OnboardingEvent.Act(OnboardingStep.ACCESSIBILITY), ready)

        assertEquals(OnboardingEffect.Open(OnboardingStep.ACCESSIBILITY), effect)
        assertEquals(setOf(OnboardingStep.ACCESSIBILITY), store.stored.attempted)
    }

    @Test
    fun nothing_is_written_when_nothing_changes() {
        val store = MemoryStore(OnboardingProgress(step = OnboardingStep.DISCLOSURE))

        assertNull(OnboardingController(store).handle(OnboardingEvent.Next, ready))
        assertEquals(0, store.saves)
    }

    @Test
    fun agreeing_again_is_saved_and_ends_onboarding() {
        val store = MemoryStore(OnboardingProgress(step = OnboardingStep.DISCLOSURE))

        OnboardingController(store).reconsent()

        assertTrue(store.stored.disclosureAccepted)
        assertTrue(store.stored.completed)
        assertTrue(!OnboardingStateMachine.needsReconsent(store.stored, armedByUser = true))
    }
}
