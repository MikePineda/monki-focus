// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.flow

/**
 * The real state of every permission, read again whenever the app comes
 * back to the foreground (plan 01 §4: nothing is assumed from the last tap).
 */
data class SetupSnapshot(
    val notifications: Boolean,
    val accessibilityService: Boolean,
    val usageAccess: Boolean,
    val batteryUnrestricted: Boolean,
    val deviceAdmin: Boolean,
    val restrictedSettings: RestrictedSettings,
) {
    companion object {
        /** Nothing granted yet, restricted settings unknown. */
        val NOTHING = SetupSnapshot(false, false, false, false, false, RestrictedSettings.NOT_APPLICABLE)
    }
}
