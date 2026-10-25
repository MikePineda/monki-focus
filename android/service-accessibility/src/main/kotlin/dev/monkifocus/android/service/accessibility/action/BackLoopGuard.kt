// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.action

import dev.monkifocus.android.service.accessibility.pipeline.ObservationKey

/**
 * BACK from a blocked surface, and HOME when BACK does not leave it (plan
 * §2.3): when the same blocked target is still on screen after [maxBacks]
 * BACKs within [windowMs], the next step is HOME.
 */
class BackLoopGuard(
    private val windowMs: Long = WINDOW_MS,
    private val maxBacks: Int = MAX_BACKS,
) {
    enum class Step { BACK, HOME }

    private var key: ObservationKey? = null
    private val backsAtMs = ArrayDeque<Long>()

    fun next(
        target: ObservationKey,
        nowMonotonicMs: Long,
    ): Step {
        if (target != key) {
            key = target
            backsAtMs.clear()
        }
        while (backsAtMs.isNotEmpty() && (nowMonotonicMs - backsAtMs.first() > windowMs || nowMonotonicMs < backsAtMs.first())) {
            backsAtMs.removeFirst()
        }
        if (backsAtMs.size >= maxBacks) {
            backsAtMs.clear()
            return Step.HOME
        }
        backsAtMs.addLast(nowMonotonicMs)
        return Step.BACK
    }

    companion object {
        const val WINDOW_MS = 1_500L
        const val MAX_BACKS = 2
    }
}
