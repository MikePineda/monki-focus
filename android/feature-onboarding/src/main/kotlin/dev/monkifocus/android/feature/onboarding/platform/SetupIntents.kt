// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.platform

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings

/**
 * The system screens onboarding and Status lead to, each as a list of
 * intents to try in order (the first that starts wins), so a device without
 * the precise screen still lands on the general one. Nothing here is sent
 * before the user taps the step's own button, and the accessibility screens
 * only after the disclosure was accepted (`OnboardingStateMachine`).
 */
object SetupIntents {
    private const val PACKAGE_SCHEME = "package"

    private fun packageUri(packageName: String): Uri = Uri.fromParts(PACKAGE_SCHEME, packageName, null)

    /** Our App info: where "Allow restricted settings" lives (⋮ menu, Android 13+). */
    fun appInfo(packageName: String): List<Intent> = listOf(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri(packageName)))

    /**
     * Our service's own page in Accessibility (API 30+, with the component
     * as `EXTRA_COMPONENT_NAME`), falling back to the Accessibility list.
     */
    fun accessibility(service: ComponentName): List<Intent> {
        val list = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return listOf(list)
        val details = Intent(Settings.ACTION_ACCESSIBILITY_DETAILS_SETTINGS)
        details.putExtra(Intent.EXTRA_COMPONENT_NAME, service.flattenToString())
        return listOf(details, list)
    }

    /** Usage access for our package, then the general list. */
    fun usageAccess(packageName: String): List<Intent> =
        listOf(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, packageUri(packageName)), Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))

    /** The app's notification settings (after the permission prompt was refused). */
    fun notificationSettings(packageName: String): List<Intent> =
        listOf(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName)) + appInfo(packageName)

    /**
     * The system dialog that exempts us from battery optimisation (needs
     * `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, allowed for this sideloaded
     * build; see the manifest), then the optimisation list.
     */
    fun batteryOptimisation(packageName: String): List<Intent> =
        listOf(
            Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, packageUri(packageName)),
            Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
        )

    /** Android's device-admin consent screen for [admin], with our [explanation]. */
    fun deviceAdmin(
        admin: ComponentName,
        explanation: String,
    ): List<Intent> =
        listOf(
            Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
                .putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, admin)
                .putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, explanation),
        )

    /** A web page in the user's browser (the OEM battery guide). */
    fun webPage(url: String): List<Intent> = listOf(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE))
}
