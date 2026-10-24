// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.usage

import dev.monkifocus.android.core.domain.usage.DeviceUsageEvent
import dev.monkifocus.android.core.domain.usage.UsageEventKind

/**
 * Maps one platform usage event (its type, package and wall time) to a
 * domain [DeviceUsageEvent], or null when the pipeline does not read that
 * type. Only activity events keep the package name; nothing else of the
 * platform event (class name, configuration, shortcut, standby bucket …) is
 * ever passed in.
 */
object UsageEventMapper {
    private val kinds =
        mapOf(
            UsageEventTypes.ACTIVITY_RESUMED to UsageEventKind.ACTIVITY_RESUMED,
            UsageEventTypes.ACTIVITY_PAUSED to UsageEventKind.ACTIVITY_PAUSED,
            UsageEventTypes.SCREEN_INTERACTIVE to UsageEventKind.SCREEN_INTERACTIVE,
            UsageEventTypes.SCREEN_NON_INTERACTIVE to UsageEventKind.SCREEN_NON_INTERACTIVE,
            UsageEventTypes.KEYGUARD_SHOWN to UsageEventKind.KEYGUARD_SHOWN,
            UsageEventTypes.KEYGUARD_HIDDEN to UsageEventKind.KEYGUARD_HIDDEN,
            UsageEventTypes.DEVICE_SHUTDOWN to UsageEventKind.DEVICE_SHUTDOWN,
        )

    fun toDomain(
        eventType: Int,
        packageName: String?,
        epochMillis: Long,
    ): DeviceUsageEvent? {
        val kind = kinds[eventType] ?: return null
        if (epochMillis < 0) return null
        return if (kind.isActivity) {
            packageName?.takeIf { it.isNotEmpty() }?.let { DeviceUsageEvent(kind, epochMillis, it) }
        } else {
            DeviceUsageEvent(kind, epochMillis, null)
        }
    }
}
