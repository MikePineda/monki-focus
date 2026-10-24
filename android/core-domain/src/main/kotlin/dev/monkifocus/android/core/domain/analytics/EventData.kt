// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

/**
 * The three ActivityWatch event payloads of `activity.schema.json` (SEMANTICS.md
 * §10): `currentwindow`, `afkstatus` and `web.tab.current`. Their required
 * keys never overlap (`app`, `status`, `domain`). A `title` is optional and
 * only kept when the user turned `storeTitles` on; a web `path` never carries
 * a query or fragment.
 */
sealed interface EventData {
    /** `windowData`: the foreground app (on Android, its package name). */
    data class Window(
        val app: String,
        val title: String? = null,
    ) : EventData

    /** `afkData`: whether the user is away (screen off or locked) or not. */
    data class Afk(
        val status: AfkStatus,
    ) : EventData

    /** `webTabData`: the focused tab, by normalised domain and path. */
    data class WebTab(
        val domain: String,
        val path: String,
        val surface: String?,
        val audible: Boolean,
        val incognito: Boolean,
        val title: String? = null,
    ) : EventData
}
