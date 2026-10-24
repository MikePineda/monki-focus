// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.analytics

import dev.monkifocus.android.core.domain.analytics.EventData

/**
 * What of an event payload may reach the disk (`docs/threat-model.md`,
 * security plan §4 Android): a title only while `storeTitles` is on and never
 * for an incognito tab; a web path cut to its first segment, without query or
 * fragment. Applied by the repository on every write, whatever the caller
 * passed.
 */
object StoredEventPrivacy {
    fun reduce(
        data: EventData,
        storeTitles: Boolean,
    ): EventData =
        when (data) {
            is EventData.Window -> {
                data.copy(title = data.title.takeIf { storeTitles })
            }

            is EventData.Afk -> {
                data
            }

            is EventData.WebTab -> {
                data.copy(
                    path = firstSegmentOf(data.path),
                    title = data.title.takeIf { storeTitles && !data.incognito },
                )
            }
        }

    /** `/watch/abc?v=1` → `/watch`; `/` and an empty path → `/`. */
    fun firstSegmentOf(path: String): String {
        val bare = path.substringBefore('?').substringBefore('#')
        val segment = bare.trimStart('/').substringBefore('/')
        return "/$segment"
    }
}
