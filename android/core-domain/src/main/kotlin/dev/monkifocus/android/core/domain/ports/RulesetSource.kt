// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

/** Where a stored rule-set revision came from, with its stored code. */
enum class RulesetSource(
    val code: String,
) {
    USER("user"),
    PRESET("preset"),
    IMPORT("import"),
    SYNC("sync"),
    ;

    companion object {
        fun ofCode(code: String): RulesetSource =
            entries.firstOrNull { it.code == code } ?: throw IllegalArgumentException("Unknown ruleset source")
    }
}
