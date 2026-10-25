// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.flow

/**
 * [PROTECTION]: the full path that ends with "Turn on protection".
 * [STATS_ONLY]: the user said "Not now" to the accessibility disclosure;
 * nothing is blocked, only usage statistics (plan 01 §4, step 1).
 */
enum class OnboardingMode {
    PROTECTION,
    STATS_ONLY,
}
