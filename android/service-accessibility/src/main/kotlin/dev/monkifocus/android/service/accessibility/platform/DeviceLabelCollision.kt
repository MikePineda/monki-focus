// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.app.admin.DevicePolicyManager
import android.content.Context
import dev.monkifocus.android.service.accessibility.guard.LabelCollision

/**
 * Computes [LabelCollision] on the device: every installed package (the app
 * declares `QUERY_ALL_PACKAGES` for this check alone) and every active
 * device admin, by label. Labels are compared in memory and never kept.
 *
 * Reading hundreds of labels is slow, so [refresh] runs off the main thread
 * (at service start and then every minute) and the guard reads the cached
 * answer. Until the first refresh, and whenever it fails, the answer is
 * "collision": the guard then lets the user through (fail toward leaving).
 */
internal class DeviceLabelCollision(
    context: Context,
    private val ownLabels: Set<String>,
) {
    private val appContext = context.applicationContext

    @Volatile
    private var cached = true

    fun exists(): Boolean = cached

    /** Blocking: call on an I/O thread. */
    fun refresh() {
        cached = runCatching { compute() }.getOrDefault(true)
    }

    private fun compute(): Boolean {
        val packages = appContext.packageManager
        val installed =
            ApplicationInfoLookup.installed(packages).map { info ->
                LabelCollision.Labelled(info.packageName, runCatching { packages.getApplicationLabel(info).toString() }.getOrNull())
            }
        val admins =
            appContext
                .getSystemService(DevicePolicyManager::class.java)
                ?.activeAdmins
                .orEmpty()
                .map { component ->
                    val label =
                        runCatching {
                            packages
                                .getApplicationLabel(
                                    ApplicationInfoLookup.of(packages, component.packageName),
                                ).toString()
                        }.getOrNull()
                    LabelCollision.Labelled(component.packageName, label)
                }
        return LabelCollision.exists(ownLabels, appContext.packageName, installed, admins)
    }
}
