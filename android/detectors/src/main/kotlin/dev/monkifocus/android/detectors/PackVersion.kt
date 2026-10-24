// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * A pack's CalVer `YYYY.MM.DD.n`, compared numerically component by component
 * (SEMANTICS.md §11): `2026.10.25.10` > `2026.10.25.9`.
 */
class PackVersion private constructor(
    private val components: List<Int>,
) : Comparable<PackVersion> {
    override fun compareTo(other: PackVersion): Int =
        components
            .zip(other.components)
            .map { (mine, theirs) -> mine.compareTo(theirs) }
            .firstOrNull { it != 0 } ?: 0

    override fun equals(other: Any?): Boolean = other is PackVersion && components == other.components

    override fun hashCode(): Int = components.hashCode()

    override fun toString(): String = components.joinToString(".")

    companion object {
        private val CALVER = Regex("""^(\d{4})\.(\d{2})\.(\d{2})\.(\d{1,3})$""")

        fun parse(text: String): PackVersion {
            val match = requireNotNull(CALVER.matchEntire(text)) { "packVersion is not YYYY.MM.DD.n" }
            return PackVersion(match.groupValues.drop(1).map(String::toInt))
        }
    }
}
