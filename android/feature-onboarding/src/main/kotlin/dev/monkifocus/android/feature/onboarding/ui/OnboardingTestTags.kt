// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.ui

import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep

/** Compose test tags of the onboarding and Status screens. */
object OnboardingTestTags {
    const val SCREEN = "onboarding.screen"
    const val DISCLOSURE_AGAIN = "onboarding.disclosure_again"
    const val BACK = "onboarding.back"
    const val NEXT = "onboarding.next"
    const val AGREE = "onboarding.disclosure.agree"
    const val NOT_NOW = "onboarding.disclosure.not_now"
    const val STATS_ONLY = "onboarding.disclosure.stats_only"
    const val ACTION = "onboarding.action"
    const val RESTRICTED_HELP = "onboarding.restricted_help"
    const val STEP_STATUS = "onboarding.step_status"
    const val BATTERY_GUIDE = "onboarding.battery_guide"
    const val FINISH = "onboarding.finish"

    fun step(step: OnboardingStep): String = "onboarding.step.${step.name.lowercase()}"

    fun fix(step: OnboardingStep): String = "onboarding.fix.${step.name.lowercase()}"
}
