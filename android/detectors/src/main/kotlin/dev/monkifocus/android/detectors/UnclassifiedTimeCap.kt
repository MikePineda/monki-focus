// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * The package + time-cap safety net of SEMANTICS.md §11 (`unclassifiedCapMinutes`):
 * when a package has an enabled surface `block` rule and its screens went
 * unclassified for at least the cap within the last 2 × cap minutes of
 * foreground use, app-level `friction` applies while it stays unclassified.
 * It keeps renamed view ids from leaving everything open.
 *
 * The time is a sliding-window sum, so a short classified blip or a quick
 * switch to another app does not reset it. Each observation attributes the
 * time since the previous one (at most [MAX_GAP_MS], so a missed event never
 * counts as hours of use) to the previous foreground state; [backgrounded]
 * closes the count when no app is in the foreground (screen off).
 *
 * Immutable and pure: each call returns the next state; time is a monotonic
 * reading in milliseconds passed in by the caller.
 */
class UnclassifiedTimeCap private constructor(
    private val foreground: String?,
    private val foregroundClassified: Boolean,
    private val sinceMs: Long,
    /** Package → unclassified foreground intervals `[start, end)`, oldest first. */
    private val unclassified: Map<String, List<LongRange>>,
) {
    fun observe(
        foregroundPackage: String,
        classified: Boolean,
        nowMonotonicMs: Long,
    ): UnclassifiedTimeCap = UnclassifiedTimeCap(foregroundPackage, classified, nowMonotonicMs, closed(nowMonotonicMs))

    /** No app in the foreground (screen off, launcher only): stop counting. */
    fun backgrounded(nowMonotonicMs: Long): UnclassifiedTimeCap = UnclassifiedTimeCap(null, true, nowMonotonicMs, closed(nowMonotonicMs))

    /** True when [foregroundPackage] is unclassified now and was for at least [capMinutes] of the last 2 × [capMinutes]. */
    fun frictionApplies(
        foregroundPackage: String,
        capMinutes: Int,
        packageHasSurfaceBlockRule: Boolean,
        nowMonotonicMs: Long,
    ): Boolean {
        if (capMinutes <= 0 || !packageHasSurfaceBlockRule) return false
        if (foreground != foregroundPackage || foregroundClassified) return false
        val cap = capMinutes * MILLIS_PER_MINUTE
        val windowStart = nowMonotonicMs - 2 * cap
        val intervals = closed(nowMonotonicMs)[foregroundPackage].orEmpty()
        val total = intervals.sumOf { overlap(it, windowStart, nowMonotonicMs) }
        return total >= cap
    }

    /** The interval map with the time since [sinceMs] attributed to the current state. */
    private fun closed(nowMonotonicMs: Long): Map<String, List<LongRange>> {
        val pkg = foreground
        val end = minOf(nowMonotonicMs, sinceMs + MAX_GAP_MS)
        val pruned = unclassified.mapValues { (_, list) -> list.filter { it.last >= nowMonotonicMs - MAX_WINDOW_MS } }
        if (pkg == null || foregroundClassified || end <= sinceMs) return pruned
        val list = pruned[pkg].orEmpty()
        val previous = list.lastOrNull()
        val merged =
            if (previous != null && previous.last + 1 >= sinceMs) {
                list.dropLast(1) + listOf(previous.first until end)
            } else {
                list + listOf(sinceMs until end)
            }
        return pruned + (pkg to merged.takeLast(MAX_INTERVALS))
    }

    private fun overlap(
        interval: LongRange,
        from: Long,
        to: Long,
    ): Long = maxOf(0, minOf(interval.last + 1, to) - maxOf(interval.first, from))

    companion object {
        /** Nothing observed yet. */
        val INITIAL = UnclassifiedTimeCap(null, true, 0, emptyMap())

        /** The longest stretch one observation may account for. */
        const val MAX_GAP_MS = 60_000L

        private const val MILLIS_PER_MINUTE = 60_000L

        /** 2 × the schema's largest cap (240 min): older intervals can never count. */
        private const val MAX_WINDOW_MS = 2 * 240 * MILLIS_PER_MINUTE

        private const val MAX_INTERVALS = 1_024
    }
}
