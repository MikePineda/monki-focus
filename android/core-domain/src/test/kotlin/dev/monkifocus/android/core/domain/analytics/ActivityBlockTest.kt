// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

/** A block is the only analytics record that syncs, so it refuses anything the schema does not allow. */
class ActivityBlockTest {
    private fun block(
        deviceId: String = "device-1",
        blockStart: String = "2026-10-25T09:05:00Z",
        activityKey: String? = "example.com",
        categoryPath: String = "news/world",
        level: Int = 25,
        seconds: Int = 120,
    ) = ActivityBlock(deviceId, blockStart, activityKey, categoryPath, level, ActivitySource.WEB, seconds)

    @Test
    fun a_valid_block_keeps_its_seven_fields() {
        val block = block()

        assertEquals("example.com", block.activityKey)
        assertEquals(120, block.seconds)
    }

    @Test
    fun null_activity_key_is_allowed_when_key_sync_is_off() {
        assertEquals(null, block(activityKey = null).activityKey)
    }

    @Test
    fun block_rejects_a_url_as_activity_key() {
        assertThrows(IllegalArgumentException::class.java) { block(activityKey = "https://example.com/watch") }
        assertThrows(IllegalArgumentException::class.java) { block(activityKey = "example.com/path") }
    }

    @Test
    fun block_rejects_an_unaligned_start() {
        assertThrows(IllegalArgumentException::class.java) { block(blockStart = "2026-10-25T09:07:00Z") }
        assertThrows(IllegalArgumentException::class.java) { block(blockStart = "2026-10-25T09:05:30Z") }
    }

    @Test
    fun block_rejects_seconds_outside_one_to_three_hundred() {
        assertThrows(IllegalArgumentException::class.java) { block(seconds = 0) }
        assertThrows(IllegalArgumentException::class.java) { block(seconds = 301) }
    }

    @Test
    fun block_rejects_unknown_levels_and_bad_category_paths() {
        assertThrows(IllegalArgumentException::class.java) { block(level = 10) }
        assertThrows(IllegalArgumentException::class.java) { block(categoryPath = "News") }
        assertThrows(IllegalArgumentException::class.java) { block(deviceId = "device 1") }
    }
}
