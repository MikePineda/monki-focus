// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Plan §5.2 and the privacy rule: a committed UI dump keeps no personal
 * text. Every `text` and `content-desc` must be empty, the placeholder, an
 * allowlisted UI label or a URL on a reserved example host
 * (`fixtures/detectors/android/label-allowlist.json`, the list
 * `sanitize-uidump.mjs` uses). Failures name the file and node, never the
 * offending value.
 */
class UiDumpSanitizationTest {
    private val allowlist =
        Json
            .parseToJsonElement(
                RulesResources.file("fixtures/detectors/android/label-allowlist.json").readText(),
            ).jsonObject
    private val placeholder = allowlist.getValue("placeholder").jsonPrimitive.content
    private val labels =
        allowlist
            .getValue("labels")
            .jsonArray
            .map { it.jsonPrimitive.content }
            .toSet()
    private val hosts = allowlist.getValue("placeholderHosts").jsonArray.map { it.jsonPrimitive.content }

    @Test
    fun uidump_fixtures_are_sanitized() {
        val problems =
            RulesResources.dumps.flatMap { file ->
                val name = RulesResources.dumpName(file)
                val dump = RulesResources.dump(name)
                val marker = if (dump.isSanitized) emptyList() else listOf("$name: missing monki-sanitized=\"1\"")
                marker +
                    BoundedTraversal(maxNodes = Int.MAX_VALUE, maxDepth = Int.MAX_VALUE - 1).walk(dump.root).nodes.flatMapIndexed {
                        index,
                        node,
                        ->
                        listOfNotNull(
                            "$name: node $index text".takeUnless { isAllowed(node.text) },
                            "$name: node $index content-desc".takeUnless { isAllowed(node.contentDescription) },
                        )
                    }
            }

        assertTrue("there are dumps to check", RulesResources.dumps.isNotEmpty())
        assertEquals(emptyList<String>(), problems)
    }

    @Test
    fun the_check_catches_a_personal_value() {
        assertTrue(isAllowed(placeholder))
        assertTrue(isAllowed("Reels"))
        assertTrue(isAllowed("https://www.example.org/r/sample"))
        assertEquals(false, isAllowed("Sender Placeholder"))
        assertEquals(false, isAllowed("https://social.invalid/someone"))
        assertEquals(false, isAllowed("reels"))
    }

    private fun isAllowed(value: String?): Boolean {
        if (value.isNullOrEmpty() || value == placeholder || value in labels) return true
        if (value.any(Char::isWhitespace)) return false
        val host =
            value
                .removePrefix("https://")
                .removePrefix("http://")
                .split('/', '?', '#', ':')
                .first()
                .lowercase()
        return hosts.any { host == it || host.endsWith(".$it") }
    }
}
