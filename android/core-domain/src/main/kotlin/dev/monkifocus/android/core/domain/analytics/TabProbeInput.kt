// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

/**
 * `activity-fixture.schema.json` `TabProbeGiven`: the browser state an
 * adapter read at `now` (SEMANTICS.md §10.2). `toString` never prints the
 * tab's URL or title.
 */
data class TabProbeInput(
    val now: String,
    val windowFocused: Boolean,
    val idleState: IdleState,
    val tab: Tab?,
    val settings: Settings,
) {
    /** The system idle state, with its wire code. */
    enum class IdleState(
        val code: String,
    ) {
        ACTIVE("active"),
        IDLE("idle"),
        LOCKED("locked"),
        ;

        companion object {
            fun ofCode(code: String): IdleState =
                entries.firstOrNull { it.code == code } ?: throw IllegalArgumentException("Unknown idle state")
        }
    }

    /** The focused tab of the focused window. */
    data class Tab(
        val url: String,
        val audible: Boolean,
        val incognito: Boolean,
        val title: String? = null,
    ) {
        override fun toString(): String = "Tab(audible=$audible, incognito=$incognito)"
    }

    /** The user's tracking settings. */
    data class Settings(
        val countAudibleWhileIdle: Boolean,
        val storeTitles: Boolean,
    )
}
