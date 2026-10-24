// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.usage

import dev.monkifocus.android.core.domain.usage.DeviceUsageEvent

/** The outcome of one read: the events, or that the user has not granted usage access (never an exception). */
sealed interface UsageEventsRead {
    data class Events(
        val events: List<DeviceUsageEvent>,
    ) : UsageEventsRead

    data object AccessNotGranted : UsageEventsRead
}
