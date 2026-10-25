// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.web

import dev.monkifocus.android.core.domain.analytics.ActivityBucket
import dev.monkifocus.android.core.domain.analytics.ActivityEvent
import dev.monkifocus.android.core.domain.analytics.EventData
import dev.monkifocus.android.core.domain.engine.utcInstantOf
import dev.monkifocus.android.core.domain.ports.ActivityEventRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Turns the pages the accessibility service reads in a browser's URL bar
 * into `web.tab.current` heartbeats (plan §2.10). Only the normalised domain,
 * the first path segment and the surface ever reach it (docs/threat-model.md
 * B4); never the full URL, the query, the title or any node text. Writes go
 * through [scope] in order; [seen] never blocks the caller.
 */
class WebHeartbeatRecorder(
    private val store: ActivityEventRepository,
    private val bucket: ActivityBucket,
    private val scope: CoroutineScope,
    private val buffer: WebHeartbeatBuffer = WebHeartbeatBuffer(),
) {
    private val writes = Mutex()

    /**
     * A page seen at [nowEpochMillis]. When the URL bar did not show the
     * path ([pathKnown] false: a domain-only bar) neither the segment nor the
     * surface is kept. A segment that may carry an encoded path, a session
     * parameter or an identifier (`%`, `;`, `/`, longer than
     * [MAX_SEGMENT_LENGTH]) is dropped: only the domain is stored.
     */
    fun seen(
        domain: String,
        firstSegment: String?,
        surface: String?,
        pathKnown: Boolean,
        nowEpochMillis: Long,
    ) {
        if (!ACCEPTED_ACTIVITY.matches(domain) || nowEpochMillis < 0) return
        val segment = firstSegment?.takeIf { pathKnown && isPlainSegment(it) }
        val path = segment?.let { "/$it" } ?: "/"
        val beat =
            ActivityEvent(
                timestamp = utcInstantOf(Math.floorDiv(nowEpochMillis, MILLIS_PER_SECOND)),
                duration = 0,
                data =
                    EventData.WebTab(
                        domain = domain,
                        path = path,
                        surface = surface.takeIf { pathKnown },
                        audible = false,
                        incognito = false,
                    ),
            )
        val toWrite = synchronized(buffer) { buffer.offer(beat) }
        if (toWrite.isEmpty()) return
        scope.launch {
            writes.withLock {
                try {
                    store.ensureBucket(bucket)
                    store.record(bucket.id, toWrite)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Exception) {
                    // A failed write loses a few seconds of one page; statistics never break protection.
                }
            }
        }
    }

    private fun isPlainSegment(segment: String): Boolean =
        segment.isNotEmpty() && segment.length <= MAX_SEGMENT_LENGTH && segment.none { it == '%' || it == ';' || it == '/' }

    private companion object {
        const val MILLIS_PER_SECOND = 1_000L

        /** Longer first segments are more likely identifiers than sections (`/watch`, `/r`, `/wiki`). */
        const val MAX_SEGMENT_LENGTH = 64

        /** What a 5-minute block accepts as an activity key; anything else (an IP literal) is not recorded. */
        val ACCEPTED_ACTIVITY = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$")
    }
}
