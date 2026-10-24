// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

/** Light or dark theme, or follow the system (the default). */
enum class ThemePreference(
    val code: String,
) {
    SYSTEM("system"),
    LIGHT("light"),
    DARK("dark"),
    ;

    companion object {
        /** Unknown codes (a newer app version wrote them) fall back to the default. */
        fun ofCode(code: String?): ThemePreference = entries.firstOrNull { it.code == code } ?: SYSTEM
    }
}
