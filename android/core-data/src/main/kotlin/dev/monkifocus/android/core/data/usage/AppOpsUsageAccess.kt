// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.usage

import android.Manifest
import android.app.AppOpsManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Process

/**
 * [UsageAccess] from the `GET_USAGE_STATS` app op, the switch the user flips
 * in Settings › Usage access. `MODE_DEFAULT` falls back to the permission
 * check, as the platform itself does.
 */
class AppOpsUsageAccess(
    context: Context,
) : UsageAccess {
    private val appContext: Context = context.applicationContext

    override fun isGranted(): Boolean {
        val appOps = appContext.getSystemService(AppOpsManager::class.java) ?: return false
        return when (appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), appContext.packageName)) {
            AppOpsManager.MODE_ALLOWED -> {
                true
            }

            AppOpsManager.MODE_DEFAULT -> {
                appContext.checkCallingOrSelfPermission(Manifest.permission.PACKAGE_USAGE_STATS) == PackageManager.PERMISSION_GRANTED
            }

            else -> {
                false
            }
        }
    }
}
