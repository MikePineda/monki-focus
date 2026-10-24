// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * Positive history for the DM-reel exemption. The classifier can only see
 * that a reel shows a reply bar and a sender; this session also requires
 * that the user came from the inbox, and bounds how long the exemption lasts:
 *
 * - a `<family>.reel_from_dm` match is kept only when the previous classified
 *   surface was `<family>.direct` at most [ENTRY_WINDOW_MS] earlier, or when
 *   it continues the DM reel session already running;
 * - a session lasts at most [MAX_SESSION_MS], measured on the monotonic clock
 *   from its start (never less than the foreground time it covers);
 * - otherwise, and after that, the same screen is `<family>.reels`.
 *
 * Unclassified reads (null) change nothing; any other surface ends the
 * session. Immutable and pure: each observation returns the next state and
 * the match to act on.
 */
class DmReelSession private constructor(
    private val lastSurface: String?,
    private val lastSurfaceAtMs: Long,
    private val sessionStartMs: Long?,
) {
    /** The next session state and the (possibly downgraded) match. */
    data class Step(
        val session: DmReelSession,
        val match: SurfaceMatch?,
    )

    fun observe(
        raw: SurfaceMatch?,
        nowMonotonicMs: Long,
    ): Step {
        if (raw == null) return Step(this, null)
        val family = raw.surface.substringBefore('.')
        if (raw.surface != "$family.$REEL_FROM_DM") return Step(DmReelSession(raw.surface, nowMonotonicMs, null), raw)
        val start = sessionStartMs
        val continuing = start != null && lastSurface == raw.surface
        val kept =
            if (start != null && continuing) {
                nowMonotonicMs - start in 0..MAX_SESSION_MS
            } else {
                lastSurface == "$family.$DIRECT" && nowMonotonicMs - lastSurfaceAtMs in 0..ENTRY_WINDOW_MS
            }
        if (kept) return Step(DmReelSession(raw.surface, nowMonotonicMs, if (continuing) start else nowMonotonicMs), raw)
        val reels = raw.copy(surface = "$family.$REELS")
        return Step(DmReelSession(reels.surface, nowMonotonicMs, null), reels)
    }

    companion object {
        /** Nothing observed yet: a DM reel needs the inbox first. */
        val INITIAL = DmReelSession(null, 0, null)

        /** The inbox must have been the previous surface at most this long before the reel. */
        const val ENTRY_WINDOW_MS = 5_000L

        /** The longest a DM reel session lasts. */
        const val MAX_SESSION_MS = 120_000L

        private const val REEL_FROM_DM = "reel_from_dm"
        private const val DIRECT = "direct"
        private const val REELS = "reels"
    }
}
