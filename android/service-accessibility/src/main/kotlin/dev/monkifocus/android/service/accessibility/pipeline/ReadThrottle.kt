// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.pipeline

/**
 * Thins out content-changed bursts before the screen is read (plan §2.4,
 * risk 7). A window-state change, a change of package or a content change
 * at least [intervalMs] after the last read is read at once. A content
 * change inside the interval is deferred: the latest one is remembered and
 * [flush] reads it once the interval is over, so the screen a burst ends on
 * is never missed.
 *
 * Time is a monotonic reading passed in by the caller; a reading that goes
 * backwards (it never should) reads at once rather than stalling.
 */
class ReadThrottle(
    private val intervalMs: Long = READ_INTERVAL_MS,
) {
    private var lastPackage: String? = null
    private var lastReadAtMs: Long = 0
    private var hasRead = false
    private var deferred: WindowEvent? = null

    /** True when [event] should be read now; false when it was deferred. */
    fun admit(event: WindowEvent): Boolean {
        val elapsed = event.monotonicMs - lastReadAtMs
        val now =
            !hasRead ||
                event.type == WindowEventType.STATE_CHANGED ||
                event.packageName != lastPackage ||
                elapsed >= intervalMs ||
                elapsed < 0
        if (now) {
            markRead(event)
        } else {
            deferred = event
        }
        return now
    }

    /** The deferred event to read at [nowMonotonicMs], or null when none waits or its interval is not over. */
    fun flush(nowMonotonicMs: Long): WindowEvent? {
        val pending = deferred ?: return null
        if (nowMonotonicMs - lastReadAtMs < intervalMs && nowMonotonicMs >= lastReadAtMs) return null
        val event = pending.copy(monotonicMs = nowMonotonicMs)
        markRead(event)
        return event
    }

    /** Milliseconds until [flush] can read the deferred event, or null when nothing waits. */
    fun flushDelayMs(nowMonotonicMs: Long): Long? {
        if (deferred == null) return null
        return (intervalMs - (nowMonotonicMs - lastReadAtMs)).coerceIn(0, intervalMs)
    }

    private fun markRead(event: WindowEvent) {
        hasRead = true
        lastPackage = event.packageName
        lastReadAtMs = event.monotonicMs
        deferred = null
    }

    companion object {
        /** At most one read per package every 250 ms while content changes (plan §2.4). */
        const val READ_INTERVAL_MS = 250L
    }
}
