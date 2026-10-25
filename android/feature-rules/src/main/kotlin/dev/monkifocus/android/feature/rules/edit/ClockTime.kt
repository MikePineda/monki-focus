// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.edit

/** A wall-clock time the user typed (`7:05`, `07:05`, `22:30`) in the schema's `HH:MM` form, or null. */
object ClockTime {
    private val INPUT = Regex("""^(\d{1,2}):(\d{2})$""")
    private const val HOURS = 24
    private const val MINUTES = 60

    fun parse(input: String): String? {
        val (hour, minute) = INPUT.matchEntire(input.trim())?.destructured ?: return null
        val h = hour.toInt()
        val m = minute.toInt()
        if (h >= HOURS || m >= MINUTES) return null
        return "%02d:%02d".format(h, m)
    }
}
