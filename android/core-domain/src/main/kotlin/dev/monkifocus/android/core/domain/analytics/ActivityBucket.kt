// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

import dev.monkifocus.android.core.domain.engine.epochSecondsOf

/**
 * An ActivityWatch bucket: `<watcher>_<hostname>` id, its type, the client
 * that writes it (`monki-focus-android`) and the user-chosen device name as
 * hostname (never a hardware model or anything personal).
 */
data class ActivityBucket(
    val id: String,
    val type: BucketType,
    val client: String,
    val hostname: String,
    val created: String,
) {
    init {
        require(id.isNotEmpty() && id.length <= MAX_ID_LENGTH) { "bucket id length" }
        epochSecondsOf(created)
    }

    private companion object {
        const val MAX_ID_LENGTH = 255
    }
}
