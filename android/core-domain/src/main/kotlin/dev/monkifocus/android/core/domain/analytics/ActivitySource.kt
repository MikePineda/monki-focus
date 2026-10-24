// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

/** `activity.schema.json#/$defs/source`, with its wire code. */
enum class ActivitySource(
    val code: String,
) {
    WEB("web"),
    APP("app"),
    ANDROID("android"),
    ;

    companion object {
        fun ofCode(code: String): ActivitySource =
            entries.firstOrNull { it.code == code } ?: throw IllegalArgumentException("Unknown activity source")
    }
}
