// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui.components

/**
 * How a countdown reads (DESIGN.md, Countdown): under a minute it is the bare
 * number of seconds (the unit is drawn apart, muted); a minute or more is
 * `m:ss`. Negative input reads as 0.
 */
object CountdownText {
    private const val SECONDS_PER_MINUTE = 60

    /** Seconds between screen-reader announcements of a running countdown. */
    const val ANNOUNCE_EVERY_SECONDS = 5

    fun showsUnit(remainingSeconds: Int): Boolean = remainingSeconds.coerceAtLeast(0) < SECONDS_PER_MINUTE

    fun digits(remainingSeconds: Int): String {
        val seconds = remainingSeconds.coerceAtLeast(0)
        if (seconds < SECONDS_PER_MINUTE) return seconds.toString()
        val minutes = seconds / SECONDS_PER_MINUTE
        val rest = seconds % SECONDS_PER_MINUTE
        return "$minutes:${rest.toString().padStart(2, '0')}"
    }

    /**
     * The announcement window of [remainingSeconds]: it changes at most once
     * every [ANNOUNCE_EVERY_SECONDS], so a polite live region is not
     * re-read on every tick (15…11 share a window, 10…6 the next, …).
     */
    fun announcementWindow(remainingSeconds: Int): Int =
        (remainingSeconds.coerceAtLeast(0) + ANNOUNCE_EVERY_SECONDS - 1) / ANNOUNCE_EVERY_SECONDS
}
