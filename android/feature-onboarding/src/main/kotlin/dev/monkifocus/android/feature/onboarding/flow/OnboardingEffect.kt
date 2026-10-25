// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.flow

/** What the platform must do after a transition. */
sealed interface OnboardingEffect {
    /** Show the prompt or open the system screen of [step]. */
    data class Open(
        val step: OnboardingStep,
    ) : OnboardingEffect

    /** Set `armedByUser`: every required step is done, the user turned protection on. */
    data object Arm : OnboardingEffect

    /** Onboarding ends with statistics only: nothing is armed. */
    data object FinishStatsOnly : OnboardingEffect
}
