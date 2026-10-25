// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.flow

/**
 * Where the user is in onboarding, persisted so it resumes after the app is
 * closed or Settings kills it: the current [step], the disclosure answer,
 * the [mode], the steps whose system screen was opened at least once
 * ([attempted], so "came back without granting" shows its help) and whether
 * onboarding was [completed].
 */
data class OnboardingProgress(
    val step: OnboardingStep = OnboardingStep.WELCOME,
    val disclosureAccepted: Boolean = false,
    val disclosureDeclined: Boolean = false,
    val mode: OnboardingMode = OnboardingMode.PROTECTION,
    val attempted: Set<OnboardingStep> = emptySet(),
    val completed: Boolean = false,
)
