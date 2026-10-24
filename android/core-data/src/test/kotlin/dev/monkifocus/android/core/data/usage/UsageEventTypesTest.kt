// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.usage

import android.app.usage.UsageEvents
import org.junit.Assert.assertEquals
import org.junit.Test

/** The mapper's plain constants are the platform's `UsageEvents.Event` values. */
class UsageEventTypesTest {
    @Test
    fun usage_event_types_match_the_platform_constants() {
        assertEquals(UsageEvents.Event.ACTIVITY_RESUMED, UsageEventTypes.ACTIVITY_RESUMED)
        assertEquals(UsageEvents.Event.ACTIVITY_PAUSED, UsageEventTypes.ACTIVITY_PAUSED)
        assertEquals(UsageEvents.Event.SCREEN_INTERACTIVE, UsageEventTypes.SCREEN_INTERACTIVE)
        assertEquals(UsageEvents.Event.SCREEN_NON_INTERACTIVE, UsageEventTypes.SCREEN_NON_INTERACTIVE)
        assertEquals(UsageEvents.Event.KEYGUARD_SHOWN, UsageEventTypes.KEYGUARD_SHOWN)
        assertEquals(UsageEvents.Event.KEYGUARD_HIDDEN, UsageEventTypes.KEYGUARD_HIDDEN)
        assertEquals(UsageEvents.Event.DEVICE_SHUTDOWN, UsageEventTypes.DEVICE_SHUTDOWN)
    }
}
