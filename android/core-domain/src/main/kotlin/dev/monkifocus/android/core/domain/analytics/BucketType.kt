// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

/** The standard ActivityWatch bucket types, with their wire codes. */
enum class BucketType(
    val code: String,
) {
    CURRENT_WINDOW("currentwindow"),
    AFK_STATUS("afkstatus"),
    WEB_TAB_CURRENT("web.tab.current"),
    ;

    companion object {
        fun ofCode(code: String): BucketType =
            entries.firstOrNull { it.code == code } ?: throw IllegalArgumentException("Unknown bucket type")
    }
}
