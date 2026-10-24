// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

/** The app language: one of the shipped catalogs, or follow the system (the default). */
enum class LanguagePreference(
    val code: String,
) {
    SYSTEM("system"),
    ENGLISH("en"),
    SPANISH("es"),
    ;

    companion object {
        /** Unknown codes (a newer app version wrote them) fall back to the default. */
        fun ofCode(code: String?): LanguagePreference = entries.firstOrNull { it.code == code } ?: SYSTEM
    }
}
