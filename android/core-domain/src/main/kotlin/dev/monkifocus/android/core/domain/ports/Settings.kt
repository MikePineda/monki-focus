// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

/**
 * The small user settings. Privacy toggles default to the private choice:
 * page titles are not stored unless the user turns [storeTitles] on.
 * [syncActivityKey] decides whether synced blocks name the domain or app
 * (off: `activityKey` is null, SEMANTICS.md §10.6).
 */
data class Settings(
    val theme: ThemePreference = ThemePreference.SYSTEM,
    val language: LanguagePreference = LanguagePreference.SYSTEM,
    val storeTitles: Boolean = false,
    val syncActivityKey: Boolean = true,
)
