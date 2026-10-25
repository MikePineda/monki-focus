// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.ui

import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.feature.onboarding.flow.BatteryGuidance
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep

/** Catalog keys for the names of the steps (missing list, checklist) and the OEM battery advice. */
object StepNames {
    fun of(step: OnboardingStep): Int =
        when (step) {
            OnboardingStep.DISCLOSURE -> R.string.step_name_disclosure
            OnboardingStep.NOTIFICATIONS -> R.string.step_name_notifications
            OnboardingStep.ACCESSIBILITY -> R.string.step_name_accessibility
            OnboardingStep.USAGE_ACCESS -> R.string.step_name_usage_access
            OnboardingStep.BATTERY -> R.string.step_name_battery
            OnboardingStep.DEVICE_ADMIN -> R.string.step_name_device_admin
            OnboardingStep.WELCOME -> R.string.onboarding_welcome_title
            OnboardingStep.RESTRICTED_SETTINGS -> R.string.onboarding_restricted_title
            OnboardingStep.TURN_ON -> R.string.onboarding_turn_on_title
        }

    fun batterySteps(guidance: BatteryGuidance): Int =
        when (guidance.steps) {
            BatteryGuidance.SAMSUNG -> R.string.onboarding_battery_samsung
            BatteryGuidance.XIAOMI -> R.string.onboarding_battery_xiaomi
            BatteryGuidance.HUAWEI -> R.string.onboarding_battery_huawei
            BatteryGuidance.VIVO -> R.string.onboarding_battery_vivo
            BatteryGuidance.ONEPLUS, BatteryGuidance.OPPO, BatteryGuidance.REALME -> R.string.onboarding_battery_oppo
            BatteryGuidance.GENERIC -> R.string.onboarding_battery_generic
        }
}
