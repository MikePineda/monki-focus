// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.flow

/** The progress after an event and what the platform must do, if anything. */
data class OnboardingTransition(
    val progress: OnboardingProgress,
    val effect: OnboardingEffect? = null,
)
