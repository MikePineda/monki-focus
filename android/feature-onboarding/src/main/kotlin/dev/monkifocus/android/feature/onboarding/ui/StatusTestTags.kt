// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.ui

import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep

/** Compose test tags of the Status screen (the app's home). */
object StatusTestTags {
    const val SCREEN = "status.screen"
    const val PROTECTION = "status.protection"
    const val STATUS_NOTICE = "status.notice"
    const val REQUEST_NOTICE = "status.notice.request"
    const val TURN_ON = "status.turn_on"
    const val EDIT_RULES = "status.edit_rules"
    const val EXIT = "status.exit"
    const val RULES = "status.rules"
    const val RULES_UNAVAILABLE = "status.rules.unavailable"

    fun item(step: OnboardingStep): String = "status.item.${step.name.lowercase()}"

    fun fix(step: OnboardingStep): String = "status.fix.${step.name.lowercase()}"
}
