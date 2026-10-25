// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.status

import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep

/** One permission on the Status checklist, the onboarding [step] that fixes it and whether it is [required]. */
data class ChecklistEntry(
    val step: OnboardingStep,
    val granted: Boolean,
    val required: Boolean,
) {
    /** Missing and required: red, kept on top with its fix button. */
    val critical: Boolean get() = required && !granted
}
