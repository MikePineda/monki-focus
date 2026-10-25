// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.edit

/** A community name the user typed: `r/name`, `/r/name/` or `name` → `name`; anything else → null. */
object SubredditName {
    private val NAME = Regex("^[A-Za-z0-9_]{2,21}$")
    private val PREFIX = Regex("^/?r/", RegexOption.IGNORE_CASE)

    fun parse(input: String): String? {
        val name = input.trim().replace(PREFIX, "").trimEnd('/')
        return name.takeIf { NAME.matches(it) }
    }
}
