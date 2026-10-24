// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

/** `afkData.status` of `activity.schema.json`, with its wire code. */
enum class AfkStatus(
    val code: String,
) {
    AFK("afk"),
    NOT_AFK("not-afk"),
    ;

    companion object {
        fun ofCode(code: String): AfkStatus =
            entries.firstOrNull { it.code == code } ?: throw IllegalArgumentException("Unknown afk status")
    }
}
