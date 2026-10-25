// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.content.Context
import dev.monkifocus.android.service.accessibility.pipeline.TargetLabels

/** Launcher labels of the watched apps for the gate's title, cached per process (a handful of packages). */
internal class AppLabels(
    context: Context,
) : TargetLabels {
    private val packages = context.applicationContext.packageManager
    private val cache = HashMap<String, String>()

    override fun appLabel(packageName: String): String =
        cache.getOrPut(packageName) {
            runCatching {
                packages
                    .getApplicationLabel(
                        ApplicationInfoLookup.of(packages, packageName),
                    ).toString()
            }.getOrDefault(packageName)
        }
}
