// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.status

import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep
import dev.monkifocus.android.feature.onboarding.flow.SetupSnapshot

/**
 * The permission checklist of the Status screen (plan 01 §4, step 8): every
 * permission with its state; a missing required one stays on top, then the
 * missing optional ones, then what is granted. With statistics only the
 * accessibility service is not required.
 */
object StatusChecklist {
    fun of(
        snapshot: SetupSnapshot,
        protectionWanted: Boolean,
    ): List<ChecklistEntry> {
        val entries =
            listOf(
                ChecklistEntry(OnboardingStep.NOTIFICATIONS, snapshot.notifications, required = protectionWanted),
                ChecklistEntry(OnboardingStep.ACCESSIBILITY, snapshot.accessibilityService, required = protectionWanted),
                ChecklistEntry(OnboardingStep.USAGE_ACCESS, snapshot.usageAccess, required = false),
                ChecklistEntry(OnboardingStep.BATTERY, snapshot.batteryUnrestricted, required = false),
                ChecklistEntry(OnboardingStep.DEVICE_ADMIN, snapshot.deviceAdmin, required = false),
            )
        return entries.sortedBy {
            when {
                it.critical -> 0
                !it.granted -> 1
                else -> 2
            }
        }
    }
}
