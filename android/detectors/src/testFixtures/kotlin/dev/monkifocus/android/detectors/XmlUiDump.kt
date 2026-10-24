// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import org.w3c.dom.Element
import java.io.InputStream
import javax.xml.XMLConstants
import javax.xml.parsers.DocumentBuilderFactory

/**
 * A `uiautomator dump` (or the app's own debug capture, same format) parsed
 * for JVM tests. [isSanitized] is the `monki-sanitized="1"` marker that
 * `packages/rules/scripts/sanitize-uidump.mjs` adds to the root.
 */
class XmlUiDump(
    val root: XmlUiNode,
    val isSanitized: Boolean,
) {
    companion object {
        fun parse(input: InputStream): XmlUiDump {
            val hierarchy = secureFactory().newDocumentBuilder().parse(input).documentElement
            require(hierarchy.tagName == "hierarchy") { "not a uiautomator dump: <${hierarchy.tagName}>" }
            val rootNode = requireNotNull(hierarchy.childElements("node").firstOrNull()) { "dump has no root node" }
            return XmlUiDump(
                root = XmlUiNode.from(rootNode),
                isSanitized = hierarchy.getAttribute("monki-sanitized") == "1",
            )
        }

        // Dumps are test data, but parse them as untrusted XML anyway: no DTDs, no external entities.
        private fun secureFactory(): DocumentBuilderFactory =
            DocumentBuilderFactory.newInstance().apply {
                setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true)
                setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
                setFeature("http://xml.org/sax/features/external-general-entities", false)
                setFeature("http://xml.org/sax/features/external-parameter-entities", false)
                isXIncludeAware = false
                isExpandEntityReferences = false
            }
    }
}

internal fun Element.childElements(tag: String): List<Element> =
    (0 until childNodes.length)
        .map { childNodes.item(it) }
        .filterIsInstance<Element>()
        .filter { it.tagName == tag }
