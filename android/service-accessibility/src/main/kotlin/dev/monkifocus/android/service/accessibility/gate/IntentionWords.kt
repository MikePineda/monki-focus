// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.gate

/**
 * Counts the words of a typed intention, the only thing about it the engine
 * and the store ever see (`commit.typedWords`). The text itself stays in
 * memory on the device.
 */
object IntentionWords {
    private val WHITE_SPACE = Regex("\\s+")

    fun count(text: String): Int = text.trim().split(WHITE_SPACE).count { it.isNotEmpty() }

    /** True when [text] repeats [previous] (trimmed, ignoring case), which a typed intention must not. */
    fun repeats(
        text: String,
        previous: String?,
    ): Boolean = previous != null && text.trim().equals(previous.trim(), ignoreCase = true)
}
