// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.flow

/** Keeps [OnboardingProgress] across process deaths (onboarding resumes where it was left). */
interface OnboardingStore {
    fun load(): OnboardingProgress

    fun save(progress: OnboardingProgress)
}
