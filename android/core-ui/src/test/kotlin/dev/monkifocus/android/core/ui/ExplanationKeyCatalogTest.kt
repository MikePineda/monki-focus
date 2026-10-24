// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui

import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.core.domain.rules.ReasonCode
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * The engine returns i18n keys, never text: every `decision.<name>` key has
 * a `decision_<name>` string in both catalogs (dots become underscores).
 */
class ExplanationKeyCatalogTest {
    private val resDir =
        File(requireNotNull(System.getProperty("monki.projectDir")) { "monki.projectDir is not set" }, "src/main/res")
    private val english = StringCatalog.read(File(resDir, "values")).translatable.keys
    private val spanish = StringCatalog.read(File(resDir, "values-es")).translatable.keys

    @Test
    fun every_engine_explanation_key_has_a_string_resource() {
        val missing = ExplanationKey.entries.map { resourceNameOf(it.key) }.filterNot { it in english && it in spanish }

        assertEquals("add these strings to values/ and values-es/", emptyList<String>(), missing)
    }

    @Test
    fun every_reason_code_but_rule_match_has_its_explanation_string() {
        val missing =
            ReasonCode.entries
                .filter { it != ReasonCode.RULE_MATCH }
                .map { resourceNameOf(ExplanationKey.ofReason(it).key) }
                .filterNot { it in english }

        assertEquals(emptyList<String>(), missing)
    }

    @Test
    fun dotted_keys_map_to_resource_names_deterministically() {
        assertEquals("decision_engine_error", resourceNameOf("decision.engine_error"))
        assertEquals("decision_budget_exhausted", resourceNameOf(ExplanationKey.BUDGET_EXHAUSTED.key))
    }

    private fun resourceNameOf(key: String): String = key.replace('.', '_')
}
