// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build

/** `getApplicationInfo` / `getInstalledApplications` without flags, on every supported API level. */
internal object ApplicationInfoLookup {
    fun of(
        packages: PackageManager,
        packageName: String,
    ): ApplicationInfo =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            packages.getApplicationInfo(packageName, PackageManager.ApplicationInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION")
            packages.getApplicationInfo(packageName, 0)
        }

    fun installed(packages: PackageManager): List<ApplicationInfo> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            packages.getInstalledApplications(PackageManager.ApplicationInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION")
            packages.getInstalledApplications(0)
        }
}
