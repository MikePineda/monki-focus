// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.pipeline

/**
 * Runs the engine only when it can say something new: when the observed
 * target ([ObservationKey]: package, surface, or host + first path segment +
 * surface) differs from the last one decided, or at least [intervalMs] after
 * the last decision for the same target (schedules, bedtime and timers move
 * on their own). [invalidate] forces the next observation through, for
 * instance after an escalation step changed what the engine would answer.
 */
class DecisionThrottle(
    private val intervalMs: Long = DECIDE_INTERVAL_MS,
) {
    private var lastKey: ObservationKey? = null
    private var lastDecidedAtMs: Long = 0

    fun admit(
        key: ObservationKey,
        nowMonotonicMs: Long,
    ): Boolean {
        val elapsed = nowMonotonicMs - lastDecidedAtMs
        val admitted = key != lastKey || elapsed >= intervalMs || elapsed < 0
        if (admitted) {
            lastKey = key
            lastDecidedAtMs = nowMonotonicMs
        }
        return admitted
    }

    fun invalidate() {
        lastKey = null
    }

    companion object {
        /** The same target is decided again at most once per second. */
        const val DECIDE_INTERVAL_MS = 1_000L
    }
}
