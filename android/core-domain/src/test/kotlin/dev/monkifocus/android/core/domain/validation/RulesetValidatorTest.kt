// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.validation

import dev.monkifocus.android.core.domain.fixtures.RulesPackage
import org.junit.Assert.assertEquals
import org.junit.Test

/** SEMANTICS.md §1: the size limit, JSON syntax and the `x-*` keywords beyond the `invalid` fixtures. */
class RulesetValidatorTest {
    private val validator = RulesPackage.validator
    private val starter = RulesPackage.text("data/presets/starter.ruleset.json")

    private fun codeOf(
        schema: String,
        text: String,
    ): String? = (validator.validateDocument(schema, text) as? ValidationResult.Rejected)?.code?.code

    private fun withZone(zone: String): String = starter.replaceFirst(Regex("\"timeZone\"\\s*:\\s*\"[^\"]*\""), "\"timeZone\": \"$zone\"")

    @Test
    fun the_starter_preset_is_valid() {
        assertEquals(ValidationResult.Valid, validator.validateDocument("ruleset", starter))
    }

    @Test
    fun oversized_document_is_rejected_as_too_large() {
        // Generated, never committed (SEMANTICS.md §12): a valid rule set padded past 256 KiB with white space.
        val padding = " ".repeat(RulesetValidator.MAX_DOCUMENT_BYTES)
        val oversized = starter.trimEnd().removeSuffix("}") + padding + "}"

        assertEquals("too_large", codeOf("ruleset", oversized))
    }

    @Test
    fun the_size_limit_counts_utf8_bytes_not_characters() {
        // 90 000 three-byte characters are 270 000 bytes but only 90 000 UTF-16 units.
        val wide = "{\"note\": \"" + "€".repeat(90_000) + "\"}"

        assertEquals("too_large", codeOf("ruleset", wide))
    }

    @Test
    fun text_that_is_not_json_is_rejected_as_invalid_json() {
        assertEquals("invalid_json", codeOf("ruleset", "{\"schemaVersion\": 1,"))
        assertEquals("invalid_json", codeOf("ruleset", "{} {}"))
        assertEquals("invalid_json", codeOf("ruleset", ""))
    }

    @Test
    fun time_zones_are_matched_case_sensitively() {
        assertEquals(null, codeOf("ruleset", withZone("Australia/Sydney")))
        assertEquals("invalid_time_zone", codeOf("ruleset", withZone("Australia/sydney")))
    }

    @Test
    fun time_zone_links_are_accepted() {
        assertEquals(null, codeOf("ruleset", withZone("Asia/Calcutta")))
        assertEquals(null, codeOf("ruleset", withZone("UTC")))
    }

    @Test
    fun an_unknown_schema_name_is_a_schema_rejection() {
        assertEquals("schema", codeOf("no-such-schema", "{}"))
    }
}
