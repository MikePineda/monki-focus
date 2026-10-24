// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

/*
 * Path globs (SEMANTICS.md §3.2): `/`, or `/`-separated segments that are a
 * literal, `*` (exactly one segment) or a final `**` (zero or more segments).
 * Literals compare ASCII case-insensitively. The schema rejects partial
 * wildcards and `%` escapes, so a glob means exactly what it says.
 */

/** The catch-all glob (slash, double star) matches every path, also an unknown one. */
internal const val CATCH_ALL_GLOB = "/**"

internal data class GlobShape(
    val literals: Int,
    val wildcards: Int,
)

private fun segmentsOf(path: String): List<String> = path.split('/').filter { it.isNotEmpty() }

/** Lower-cases `A`–`Z` only, never other letters. */
internal fun asciiLower(text: String): String = buildString(text.length) { for (c in text) append(if (c in 'A'..'Z') c + 32 else c) }

private fun matchSegments(
    glob: List<String>,
    path: List<String>,
): Boolean {
    var index = 0
    while (true) {
        if (index == glob.size) return index == path.size
        val head = glob[index]
        if (head == "**") return true
        if (index == path.size) return false
        if (head != "*" && asciiLower(head) != asciiLower(path[index])) return false
        index += 1
    }
}

/** Whether a normalised path (`/`, `/a/b`) matches the glob. */
internal fun matchesGlob(
    glob: String,
    path: String,
): Boolean = matchSegments(segmentsOf(glob), segmentsOf(path))

/** Literal segments and wildcards (`*` and `**` count 1 each) of a glob. */
internal fun globShape(glob: String): GlobShape {
    val segments = segmentsOf(glob)
    val wildcards = segments.count { it == "*" || it == "**" }
    return GlobShape(literals = segments.size - wildcards, wildcards = wildcards)
}
