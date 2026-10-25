// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.flow

/**
 * The onboarding steps in their order (plan 01 §4). Only [DISCLOSURE],
 * [NOTIFICATIONS] and [ACCESSIBILITY] are required to turn protection on;
 * [RESTRICTED_SETTINGS] shows only where Android may block the
 * accessibility switch. The disclosure always comes before any step that
 * leads to system settings.
 */
enum class OnboardingStep {
    WELCOME,
    DISCLOSURE,
    RESTRICTED_SETTINGS,
    NOTIFICATIONS,
    ACCESSIBILITY,
    USAGE_ACCESS,
    BATTERY,
    DEVICE_ADMIN,
    TURN_ON,
}
