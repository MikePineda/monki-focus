// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.transfer

import dev.monkifocus.android.core.domain.ports.RulesetSource
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.validation.RejectionCode
import dev.monkifocus.android.feature.rules.change.RuleChangeOutcome
import dev.monkifocus.android.feature.rules.change.RuleChangeService
import dev.monkifocus.android.feature.rules.change.RulesetCheck
import dev.monkifocus.android.feature.rules.support.InMemoryRulesetRepository
import dev.monkifocus.android.feature.rules.support.MutableClock
import dev.monkifocus.android.feature.rules.support.RulesData
import dev.monkifocus.android.feature.rules.support.RulesetFactory.aRule
import dev.monkifocus.android.feature.rules.support.RulesetFactory.aRuleset
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RulesetTransferTest {
    @Test
    fun an_exported_set_imports_back_unchanged() {
        val ruleset = aRuleset()

        val text = RulesetTransfer.export(ruleset)

        assertEquals(ImportedRuleset.Valid(ruleset), RulesetTransfer.import(text, RulesData.validator))
        assertEquals("monki-focus-rules-2026-10-01.json", RulesetTransfer.fileName(ruleset))
    }

    @Test
    fun the_extension_preset_file_imports() {
        val text = RulesData.file("data/presets/starter.ruleset.json").readText()

        assertTrue(RulesetTransfer.import(text, RulesData.validator) is ImportedRuleset.Valid)
    }

    @Test
    fun text_that_is_not_json_is_refused() {
        assertEquals(ImportedRuleset.Invalid(RejectionCode.INVALID_JSON, null), RulesetTransfer.import("{ nope", RulesData.validator))
    }

    @Test
    fun an_invalid_set_names_the_failing_field_and_never_its_value() {
        val text = RulesetTransfer.export(aRuleset()).replace("\"friction\"", "\"secret-mode-value\"")

        val result = RulesetTransfer.import(text, RulesData.validator) as ImportedRuleset.Invalid

        assertEquals(RejectionCode.SCHEMA, result.code)
        assertTrue(result.location.orEmpty(), result.location.orEmpty().contains("rules"))
        assertTrue(!result.location.orEmpty().contains("secret"))
    }

    @Test
    fun an_unknown_field_is_refused() {
        val text = RulesetTransfer.export(aRuleset()).replaceFirst("{", "{\n  \"extra\": 1,")

        assertEquals(RejectionCode.SCHEMA, (RulesetTransfer.import(text, RulesData.validator) as ImportedRuleset.Invalid).code)
    }

    @Test
    fun an_invalid_import_changes_nothing_and_a_looser_one_waits() =
        runBlocking {
            val repository = InMemoryRulesetRepository(aRuleset())
            val service =
                RuleChangeService(repository, RulesData.catalog, RulesetCheck.of(RulesData.validator), { aRuleset() }, MutableClock(NOW))
            assertTrue(RulesetTransfer.import("[]", RulesData.validator) is ImportedRuleset.Invalid)
            assertEquals(0, repository.commits)

            val looser = aRuleset(rules = listOf(aRule(mode = RuleMode.ALLOW)))
            val imported = RulesetTransfer.import(RulesetTransfer.export(looser), RulesData.validator) as ImportedRuleset.Valid
            val outcome = service.edit(service.state(), RulesetSource.IMPORT) { imported.ruleset }

            assertEquals("2026-10-27T22:00:00Z", (outcome as RuleChangeOutcome.Pending).effectiveFrom)
            assertEquals(
                RuleMode.FRICTION,
                repository
                    .active(NOW)!!
                    .ruleset.rules[0]
                    .mode,
            )
            assertEquals(RulesetSource.IMPORT, repository.pending(NOW)!!.source)
        }

    private companion object {
        const val NOW = "2026-10-27T10:00:00Z"
    }
}
