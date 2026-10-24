// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * The package + time-cap safety net of SEMANTICS.md §11 (`unclassifiedCapMinutes`):
 * when a package has an enabled surface `block` rule and the classifier has
 * recognised no surface of it for more than the pack's cap of continuous
 * foreground time, app-level `friction` applies until a surface is
 * recognised again. It keeps renamed view ids from leaving everything open.
 *
 * Immutable and pure: each foreground observation returns the next state;
 * time is a monotonic reading in milliseconds passed in by the caller.
 * Leaving the package or recognising a surface restarts the count.
 */
class UnclassifiedTimeCap private constructor(
    private val packageName: String?,
    private val unclassifiedSinceMs: Long?,
) {
    fun observe(
        foregroundPackage: String,
        classified: Boolean,
        nowMonotonicMs: Long,
    ): UnclassifiedTimeCap =
        when {
            classified -> UnclassifiedTimeCap(foregroundPackage, null)

            foregroundPackage != packageName || unclassifiedSinceMs == null -> UnclassifiedTimeCap(foregroundPackage, nowMonotonicMs)

            // The monotonic clock restarted (reboot): count from now.
            nowMonotonicMs < unclassifiedSinceMs -> UnclassifiedTimeCap(foregroundPackage, nowMonotonicMs)

            else -> this
        }

    /** True when [foregroundPackage] has been unclassified for longer than [capMinutes] (0 = off). */
    fun frictionApplies(
        foregroundPackage: String,
        capMinutes: Int,
        packageHasSurfaceBlockRule: Boolean,
        nowMonotonicMs: Long,
    ): Boolean {
        val since = unclassifiedSinceMs ?: return false
        if (capMinutes <= 0 || !packageHasSurfaceBlockRule || foregroundPackage != packageName) return false
        return nowMonotonicMs - since > capMinutes * MILLIS_PER_MINUTE
    }

    companion object {
        /** Nothing observed yet. */
        val INITIAL = UnclassifiedTimeCap(null, null)

        private const val MILLIS_PER_MINUTE = 60_000L
    }
}
