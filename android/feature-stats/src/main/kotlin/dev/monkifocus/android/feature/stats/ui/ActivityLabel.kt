// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.ui

import android.content.pm.PackageManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import dev.monkifocus.android.core.domain.analytics.ActivitySource
import dev.monkifocus.android.core.domain.analytics.BROWSER_UNKNOWN
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.feature.stats.model.TodayStats

/**
 * How an activity is named on screen: a site by its domain, an app by its
 * launcher label (looked up on this device only, never stored), browser time
 * without a page read by the catalog's name for it.
 */
@Composable
internal fun activityLabel(activity: TodayStats.TopActivity): String {
    if (activity.activityKey == BROWSER_UNKNOWN) return stringResource(R.string.stats_browser_unknown)
    if (activity.source == ActivitySource.WEB) return activity.activityKey
    val packageManager = LocalContext.current.packageManager
    return remember(activity.activityKey) { appLabel(packageManager, activity.activityKey) }
}

private fun appLabel(
    packageManager: PackageManager,
    packageName: String,
): String =
    try {
        @Suppress("DEPRECATION")
        packageManager.getApplicationLabel(packageManager.getApplicationInfo(packageName, 0)).toString()
    } catch (_: PackageManager.NameNotFoundException) {
        packageName
    }
