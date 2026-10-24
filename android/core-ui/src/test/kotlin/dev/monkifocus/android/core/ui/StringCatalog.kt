// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui

import org.w3c.dom.Element
import java.io.File
import javax.xml.XMLConstants
import javax.xml.parsers.DocumentBuilderFactory

/**
 * The entries of one `values*` directory: every `<string>`, `<plurals>` and
 * `<string-array>` with its format placeholders (`%s`, `%1$d`, …).
 */
class StringCatalog private constructor(
    val translatable: Map<String, List<String>>,
    val untranslatable: Set<String>,
) {
    companion object {
        private val ENTRY_TAGS = setOf("string", "plurals", "string-array")
        private val PLACEHOLDER = Regex("""%(\d+\$)?[-#+ 0,(]*\d*(\.\d+)?[a-zA-Z]""")

        fun read(valuesDir: File): StringCatalog {
            val translatable = sortedMapOf<String, List<String>>()
            val untranslatable = sortedSetOf<String>()
            valuesDir
                .listFiles { file -> file.extension == "xml" }
                .orEmpty()
                .sortedBy { it.name }
                .forEach { file ->
                    val resources = secureFactory().newDocumentBuilder().parse(file).documentElement
                    resources.entries().forEach { entry ->
                        val name = entry.getAttribute("name")
                        if (entry.getAttribute("translatable") == "false") {
                            untranslatable += name
                        } else {
                            translatable[name] = placeholdersOf(entry.textContent)
                        }
                    }
                }
            return StringCatalog(translatable, untranslatable)
        }

        private fun placeholdersOf(text: String): List<String> =
            PLACEHOLDER
                .findAll(text.replace("%%", ""))
                .map { it.value }
                .sorted()
                .toList()

        private fun Element.entries(): List<Element> =
            (0 until childNodes.length)
                .map { childNodes.item(it) }
                .filterIsInstance<Element>()
                .filter { it.tagName in ENTRY_TAGS }

        private fun secureFactory(): DocumentBuilderFactory =
            DocumentBuilderFactory.newInstance().apply {
                setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true)
                setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
                isExpandEntityReferences = false
            }
    }
}
