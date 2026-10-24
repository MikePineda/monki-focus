// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import java.time.DateTimeException
import java.time.LocalDate
import java.util.Locale

/**
 * A pack's CalVer `YYYY.MM.DD.n`, compared numerically component by component
 * (SEMANTICS.md §11): `2026.10.25.10` > `2026.10.25.9`. The date must exist
 * on the calendar (no month 13, no 30 February) and `n` has no leading zero.
 */
class PackVersion private constructor(
    /** The release day the version names. */
    val date: LocalDate,
    private val serial: Int,
) : Comparable<PackVersion> {
    override fun compareTo(other: PackVersion): Int = compareValuesBy(this, other, { it.date }, { it.serial })

    override fun equals(other: Any?): Boolean = other is PackVersion && date == other.date && serial == other.serial

    override fun hashCode(): Int = 31 * date.hashCode() + serial

    override fun toString(): String = String.format(Locale.ROOT, "%04d.%02d.%02d.%d", date.year, date.monthValue, date.dayOfMonth, serial)

    companion object {
        private val CALVER = Regex("""^(\d{4})\.(\d{2})\.(\d{2})\.(0|[1-9]\d{0,2})$""")

        /** Parses [text]; throws [IllegalArgumentException] for anything but a real calendar date and serial. */
        fun parse(text: String): PackVersion {
            val match = requireNotNull(CALVER.matchEntire(text)) { "packVersion is not YYYY.MM.DD.n" }
            val (year, month, day, serial) = match.destructured
            val date =
                try {
                    LocalDate.of(year.toInt(), month.toInt(), day.toInt())
                } catch (_: DateTimeException) {
                    throw IllegalArgumentException("packVersion names no calendar date")
                }
            return PackVersion(date, serial.toInt())
        }

        /** [text] parsed, or null when it is not a valid pack version. */
        fun parseOrNull(text: String): PackVersion? =
            try {
                parse(text)
            } catch (_: IllegalArgumentException) {
                null
            }
    }
}
