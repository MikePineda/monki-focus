// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.PowerManager
import android.os.Process
import androidx.core.app.NotificationManagerCompat
import dev.monkifocus.android.core.data.usage.AppOpsUsageAccess
import dev.monkifocus.android.feature.onboarding.flow.RestrictedSettings
import dev.monkifocus.android.feature.onboarding.flow.SetupSnapshot

/**
 * Reads every permission onboarding and Status show, as it is right now
 * ([SetupSnapshot]). Read again on every resume and while an onboarding step
 * waits on a system switch; nothing is cached and nothing is stored.
 *
 * Restricted settings (Android 13+): the app-op Android keeps for them is
 * read for our own package when the device allows it; otherwise the
 * installer decides a guess (see [RestrictedSettings.assess]).
 */
class SystemSetupProbe(
    context: Context,
    private val accessibilityEnabled: () -> Boolean,
    private val deviceAdmin: ComponentName,
) {
    private val appContext = context.applicationContext
    private val usageAccess = AppOpsUsageAccess(appContext)

    fun snapshot(): SetupSnapshot =
        SetupSnapshot(
            notifications = NotificationManagerCompat.from(appContext).areNotificationsEnabled(),
            accessibilityService = accessibilityEnabled(),
            usageAccess = runCatching { usageAccess.isGranted() }.getOrDefault(false),
            batteryUnrestricted =
                appContext.getSystemService(PowerManager::class.java)?.isIgnoringBatteryOptimizations(appContext.packageName) == true,
            deviceAdmin = appContext.getSystemService(DevicePolicyManager::class.java)?.isAdminActive(deviceAdmin) == true,
            restrictedSettings = RestrictedSettings.assess(Build.VERSION.SDK_INT, installer(), restrictedSettingsMode()),
        )

    private fun installer(): String? =
        runCatching {
            val packageManager = appContext.packageManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                packageManager.getInstallSourceInfo(appContext.packageName).installingPackageName
            } else {
                @Suppress("DEPRECATION")
                packageManager.getInstallerPackageName(appContext.packageName)
            }
        }.getOrNull()

    private fun restrictedSettingsMode(): Int? {
        if (Build.VERSION.SDK_INT < RestrictedSettings.FIRST_SDK) return null
        val appOps = appContext.getSystemService(AppOpsManager::class.java) ?: return null
        return runCatching { appOps.unsafeCheckOpNoThrow(RESTRICTED_SETTINGS_OP, Process.myUid(), appContext.packageName) }.getOrNull()
    }

    private companion object {
        /** `AppOpsManager.OPSTR_ACCESS_RESTRICTED_SETTINGS` (not in the public SDK); unknown ops throw and read as unknown. */
        const val RESTRICTED_SETTINGS_OP = "android:access_restricted_settings"
    }
}
