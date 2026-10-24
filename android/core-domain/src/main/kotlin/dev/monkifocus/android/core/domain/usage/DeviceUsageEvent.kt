// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.usage

/**
 * One system usage event reduced to what the analytics pipeline needs: its
 * kind, its wall time in epoch milliseconds and, for activity events only,
 * the package name. Activity class names, configuration, shortcut ids and
 * every other field of the platform event are never kept.
 */
data class DeviceUsageEvent(
    val kind: UsageEventKind,
    val epochMillis: Long,
    val packageName: String?,
) {
    init {
        require(epochMillis >= 0) { "epochMillis must be non-negative" }
        require((packageName != null) == kind.isActivity) { "Only activity events carry a package name" }
        require(packageName == null || packageName.isNotEmpty()) { "Empty package name" }
    }
}
