// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.buildlogic

/**
 * The app version, read from `VERSION_NAME` in `gradle.properties`.
 *
 * release-please bumps that line through its `# x-release-please-version`
 * annotation. A `.properties` file has no trailing comments, so the
 * annotation is part of the raw value and is stripped here.
 */
data class MonkiVersion(
    val major: Int,
    val minor: Int,
    val patch: Int,
) {
    init {
        require(major >= 0 && minor in 0..MAX_PART && patch in 0..MAX_PART) {
            "Version parts must be >= 0 and minor/patch <= $MAX_PART, got $major.$minor.$patch"
        }
    }

    val name: String get() = "$major.$minor.$patch"

    /**
     * `major * 1_000_000 + minor * 1_000 + patch`, monotonic for every valid
     * version. Android rejects 0, so the never-released `0.0.0` placeholder
     * maps to 1 (it shares the code with 0.0.1, which is never published either).
     */
    val code: Int get() = (major * 1_000_000 + minor * 1_000 + patch).coerceAtLeast(1)

    companion object {
        private const val MAX_PART = 999
        private val SEMVER = Regex("""^(\d+)\.(\d+)\.(\d+)$""")

        fun fromGradleProperty(raw: String): MonkiVersion {
            val value = raw.substringBefore('#').trim()
            val match =
                requireNotNull(SEMVER.matchEntire(value)) {
                    "VERSION_NAME must be plain MAJOR.MINOR.PATCH, got '$value'"
                }
            val (major, minor, patch) = match.destructured
            return MonkiVersion(major.toInt(), minor.toInt(), patch.toInt())
        }
    }
}
