// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.w3c.dom.Element
import java.io.File
import javax.xml.XMLConstants
import javax.xml.parsers.DocumentBuilderFactory

/**
 * Plan §5.2 and the privacy rule: a committed UI dump keeps no personal
 * text. Every text-bearing attribute (`text`, `content-desc`, `hint`, …)
 * must be empty, the placeholder, an allowlisted UI label or a URL on a
 * reserved example host, and every other attribute must be a known
 * uiautomator one (`fixtures/detectors/android/label-allowlist.json`, the
 * list `sanitize-uidump.mjs` uses). Failures name the file, element and
 * attribute, never the offending value.
 */
class UiDumpSanitizationTest {
    private val allowlist: JsonObject =
        Json.parseToJsonElement(RulesResources.file("fixtures/detectors/android/label-allowlist.json").readText()).jsonObject
    private val placeholder = allowlist.getValue("placeholder").jsonPrimitive.content
    private val labels = allowlist.strings("labels").toSet()
    private val hosts = allowlist.strings("placeholderHosts")
    private val textAttributes = allowlist.strings("textAttributes").toSet()
    private val knownAttributes: Map<String, Set<String>> =
        allowlist.getValue("knownAttributes").jsonObject.mapValues { (_, names) ->
            names.jsonArray.map { it.jsonPrimitive.content }.toSet()
        }

    private fun JsonObject.strings(key: String): List<String> = getValue(key).jsonArray.map { it.jsonPrimitive.content }

    private fun elements(file: File): List<Element> {
        val factory =
            DocumentBuilderFactory.newInstance().apply {
                setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true)
                setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
                isExpandEntityReferences = false
            }
        val root = factory.newDocumentBuilder().parse(file).documentElement
        val all = root.getElementsByTagName("*")
        return listOf(root) + (0 until all.length).map { all.item(it) as Element }
    }

    @Test
    fun uidump_fixtures_are_sanitized() {
        val problems =
            RulesResources.dumps.flatMap { file ->
                val name = RulesResources.dumpName(file)
                val marker = if (RulesResources.dump(name).isSanitized) emptyList() else listOf("$name: missing monki-sanitized=\"1\"")
                marker +
                    elements(file).flatMapIndexed { index, element ->
                        val attributes = element.attributes
                        (0 until attributes.length).mapNotNull { at ->
                            val attribute = attributes.item(at)
                            val where = "$name: <${element.tagName}> #$index ${attribute.nodeName}"
                            when {
                                element.tagName == "node" && attribute.nodeName in textAttributes -> {
                                    where.takeUnless {
                                        isAllowed(
                                            attribute.nodeValue,
                                        )
                                    }
                                }

                                attribute.nodeName in knownAttributes[element.tagName].orEmpty() -> {
                                    null
                                }

                                else -> {
                                    "$where is not a known attribute"
                                }
                            }
                        }
                    }
            }

        assertTrue("there are dumps to check", RulesResources.dumps.isNotEmpty())
        assertEquals(emptyList<String>(), problems)
    }

    @Test
    fun the_check_covers_every_text_bearing_attribute() {
        assertEquals(
            setOf("text", "content-desc", "hint", "tooltip-text", "pane-title", "state-description", "error", "container-title"),
            textAttributes,
        )
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
