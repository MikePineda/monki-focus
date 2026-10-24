// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.usage

import dev.monkifocus.android.core.domain.usage.DeviceUsageEvent
import dev.monkifocus.android.core.domain.usage.UsageEventKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class UsageEventMapperTest {
    @Test
    fun activity_events_keep_kind_time_and_package() {
        assertEquals(
            DeviceUsageEvent(UsageEventKind.ACTIVITY_RESUMED, 1_000, "com.example.video"),
            UsageEventMapper.toDomain(UsageEventTypes.ACTIVITY_RESUMED, "com.example.video", 1_000),
        )
        assertEquals(
            DeviceUsageEvent(UsageEventKind.ACTIVITY_PAUSED, 2_000, "com.example.video"),
            UsageEventMapper.toDomain(UsageEventTypes.ACTIVITY_PAUSED, "com.example.video", 2_000),
        )
    }

    @Test
    fun device_events_drop_the_package() {
        val cases =
            mapOf(
                UsageEventTypes.SCREEN_INTERACTIVE to UsageEventKind.SCREEN_INTERACTIVE,
                UsageEventTypes.SCREEN_NON_INTERACTIVE to UsageEventKind.SCREEN_NON_INTERACTIVE,
                UsageEventTypes.KEYGUARD_SHOWN to UsageEventKind.KEYGUARD_SHOWN,
                UsageEventTypes.KEYGUARD_HIDDEN to UsageEventKind.KEYGUARD_HIDDEN,
                UsageEventTypes.DEVICE_SHUTDOWN to UsageEventKind.DEVICE_SHUTDOWN,
            )

        cases.forEach { (type, kind) ->
            assertEquals(DeviceUsageEvent(kind, 5_000, null), UsageEventMapper.toDomain(type, "android", 5_000))
        }
    }

    @Test
    fun other_event_types_are_not_read() {
        // CONFIGURATION_CHANGE (5), SHORTCUT_INVOCATION (8), STANDBY_BUCKET_CHANGED (11), ACTIVITY_STOPPED (23).
        listOf(5, 8, 11, 23, 0, 999).forEach { type -> assertNull(UsageEventMapper.toDomain(type, "com.example.video", 1_000)) }
    }

    @Test
    fun an_activity_event_without_package_or_with_a_negative_time_is_dropped() {
        assertNull(UsageEventMapper.toDomain(UsageEventTypes.ACTIVITY_RESUMED, null, 1_000))
        assertNull(UsageEventMapper.toDomain(UsageEventTypes.ACTIVITY_RESUMED, "", 1_000))
        assertNull(UsageEventMapper.toDomain(UsageEventTypes.SCREEN_INTERACTIVE, null, -1))
    }
}
