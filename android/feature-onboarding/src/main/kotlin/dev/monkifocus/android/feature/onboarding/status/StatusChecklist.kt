// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.status

import dev.monkifocus.android.feature.onboarding.flow.OnboardingMode
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep
import dev.monkifocus.android.feature.onboarding.flow.SetupSnapshot

/**
 * The permission checklist of the Status screen (plan 01 §4, step 8): every
 * permission with its state; a missing required one stays on top, then the
 * missing optional ones, then what is granted. With statistics only the
 * accessibility service is not required, and battery and uninstall
 * protection (which only serve protection) are not listed. While Android's
 * restricted settings may block the accessibility switch, an item leads to
 * App info.
 */
object StatusChecklist {
    /** Protection is what the user wants once it is armed, or while they walk its path. */
    fun protectionWanted(
        armedByUser: Boolean,
        mode: OnboardingMode,
    ): Boolean = armedByUser || mode == OnboardingMode.PROTECTION

    fun of(
        snapshot: SetupSnapshot,
        protectionWanted: Boolean,
    ): List<ChecklistEntry> {
        val restrictedBlocks = protectionWanted && snapshot.restrictedSettings.mayBlock && !snapshot.accessibilityService
        val entries =
            listOfNotNull(
                ChecklistEntry(OnboardingStep.NOTIFICATIONS, snapshot.notifications, required = protectionWanted),
                ChecklistEntry(OnboardingStep.ACCESSIBILITY, snapshot.accessibilityService, required = protectionWanted),
                if (restrictedBlocks) ChecklistEntry(OnboardingStep.RESTRICTED_SETTINGS, granted = false, required = false) else null,
                ChecklistEntry(OnboardingStep.USAGE_ACCESS, snapshot.usageAccess, required = false),
                if (protectionWanted) ChecklistEntry(OnboardingStep.BATTERY, snapshot.batteryUnrestricted, required = false) else null,
                if (protectionWanted) ChecklistEntry(OnboardingStep.DEVICE_ADMIN, snapshot.deviceAdmin, required = false) else null,
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
