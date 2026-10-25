// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.bypass

import dev.monkifocus.android.core.domain.engine.utcInstantOf
import dev.monkifocus.android.core.domain.ports.BypassEvent

/**
 * Builds bypass events (codes and short code values only: no URL, title,
 * label or node text can fit, `BypassEvent` enforces it) and queues them.
 * Never throws: a detail that does not fit is dropped, and an event that
 * cannot be built is not recorded rather than taking the service down.
 */
class BypassRecorder(
    private val sink: BypassSink,
    private val newId: () -> String,
) {
    fun record(
        kind: BypassKind,
        occurredAtEpochMs: Long,
        detectedAtEpochMs: Long = occurredAtEpochMs,
        details: Map<String, String> = emptyMap(),
    ): BypassEvent? {
        val occurred = utcInstantOf(Math.floorDiv(occurredAtEpochMs, MILLIS_PER_SECOND))
        val detected = utcInstantOf(Math.floorDiv(maxOf(occurredAtEpochMs, detectedAtEpochMs), MILLIS_PER_SECOND))
        val event =
            runCatching { BypassEvent(newId(), kind.code, occurred, detected, details) }.getOrNull()
                ?: runCatching { BypassEvent(newId(), kind.code, occurred, detected) }.getOrNull()
                ?: return null
        runCatching { sink.enqueue(event) }
        return event
    }

    private companion object {
        const val MILLIS_PER_SECOND = 1_000L
    }
}
