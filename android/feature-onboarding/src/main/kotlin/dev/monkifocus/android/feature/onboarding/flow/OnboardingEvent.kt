// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.flow

/** What the user did on an onboarding screen. */
sealed interface OnboardingEvent {
    data object Next : OnboardingEvent

    data object Back : OnboardingEvent

    /** "I agree" on the accessibility disclosure. */
    data object AcceptDisclosure : OnboardingEvent

    /** "Not now" on the accessibility disclosure. */
    data object DeclineDisclosure : OnboardingEvent

    /** After declining: go on with statistics only. */
    data object ContinueStatsOnly : OnboardingEvent

    /** The step's own button: the prompt or the system screen it leads to. */
    data class Act(
        val step: OnboardingStep,
    ) : OnboardingEvent

    /** A "Fix" link on the last step: back to a step that is still missing. */
    data class GoTo(
        val step: OnboardingStep,
    ) : OnboardingEvent

    /** "Turn on protection" (or "Finish" with statistics only). */
    data object Finish : OnboardingEvent
}
