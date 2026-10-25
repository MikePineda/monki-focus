// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import dev.monkifocus.android.background.web.WebHeartbeatRecorder
import dev.monkifocus.android.service.accessibility.pipeline.UrlKey

/**
 * The accessibility service's URL-bar reading as a statistics heartbeat:
 * only the key's host, first segment and surface go through, and the
 * recorder drops the segment and surface when the bar did not show the path.
 */
fun WebHeartbeatRecorder.siteSeen(
    key: UrlKey,
    nowEpochMs: Long,
) {
    seen(key.host, key.firstSegment, key.surface, key.pathKnown, nowEpochMs)
}
