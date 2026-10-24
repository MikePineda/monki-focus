// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

/**
 * `activity.schema.json#/$defs/block`: the only analytics record that leaves
 * the device (SEMANTICS.md §10.6), exactly seven fields. It never carries a
 * title, a URL or a path: `activityKey` is a normalised domain or a package
 * name, or null when the user turned key sync off. Construction is the single
 * door every block goes through, so a value that does not fit the schema (a
 * URL passed as a key, an unaligned start) is rejected here.
 *
 * Its natural key is `(deviceId, blockStart, activityKey, categoryPath,
 * source, level)`; `seconds` is the value.
 */
data class ActivityBlock(
    val deviceId: String,
    val blockStart: String,
    val activityKey: String?,
    val categoryPath: String,
    val level: Int,
    val source: ActivitySource,
    val seconds: Int,
) {
    init {
        require(DEVICE_ID.matches(deviceId)) { "Invalid sync block deviceId" }
        require(BLOCK_START.matches(blockStart)) { "Invalid sync block blockStart" }
        require(activityKey == null || ACTIVITY_KEY.matches(activityKey)) { "Invalid sync block activityKey" }
        require(categoryPath.length <= MAX_CATEGORY_PATH && CATEGORY_PATH.matches(categoryPath)) { "Invalid sync block categoryPath" }
        require(level in LEVELS) { "Invalid sync block level" }
        require(seconds in 1..BLOCK_SECONDS) { "Invalid sync block seconds" }
    }

    companion object {
        /** Seconds in a block, and the cap on one device's block start. */
        const val BLOCK_SECONDS = 300

        val LEVELS: Set<Int> = setOf(0, 25, 50, 75, 100)

        private const val MAX_CATEGORY_PATH = 96
        private val DEVICE_ID = Regex("^[A-Za-z0-9_-]{1,64}$")
        private val BLOCK_START = Regex("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-5][05]:00Z$")
        private val ACTIVITY_KEY = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$")
        private val CATEGORY_PATH = Regex("^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*$")
    }
}
