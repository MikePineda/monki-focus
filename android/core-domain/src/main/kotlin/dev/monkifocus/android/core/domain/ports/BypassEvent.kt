// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

import dev.monkifocus.android.core.domain.engine.epochSecondsOf

/**
 * Something that weakened the protection (the accessibility service turned
 * off, usage access revoked, a clock change …), as a reason code. The guardian
 * may see it, so it carries no URL, title, node text or free text at all:
 * [kind] is a snake_case code and [details] are short codes and numbers
 * (`[A-Za-z0-9._:-]`, at most 64 characters, so no slash, space or URL fits).
 */
data class BypassEvent(
    val id: String,
    val kind: String,
    val occurredAt: String,
    val detectedAt: String,
    val details: Map<String, String> = emptyMap(),
) {
    init {
        require(id.isNotEmpty() && id.length <= MAX_ID_LENGTH) { "Invalid bypass event id" }
        require(CODE.matches(kind)) { "Bypass kind must be a code" }
        require(epochSecondsOf(occurredAt) <= epochSecondsOf(detectedAt)) { "Detected before it occurred" }
        require(details.size <= MAX_DETAILS) { "Too many bypass details" }
        details.forEach { (key, value) ->
            require(CODE.matches(key)) { "Bypass detail keys must be codes" }
            require(DETAIL_VALUE.matches(value)) { "Bypass detail values must be short codes" }
        }
    }

    private companion object {
        const val MAX_ID_LENGTH = 64
        const val MAX_DETAILS = 8
        val CODE = Regex("^[a-z][a-z0-9_]{0,63}$")
        val DETAIL_VALUE = Regex("^[A-Za-z0-9._:-]{0,64}$")
    }
}
