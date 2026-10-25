// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.transfer

import dev.monkifocus.android.core.domain.rules.RulesJson
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.validation.RejectionCode
import dev.monkifocus.android.core.domain.validation.RulesetValidator
import dev.monkifocus.android.core.domain.validation.ValidationResult
import dev.monkifocus.android.feature.rules.change.RulesetCheck
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

/**
 * Export and import of the rule set as JSON (the extension's file format, so
 * a set moves between the two). Import validates the whole text with the
 * rules schemas first; the valid set is then proposed like any edit, so a
 * looser import waits.
 */
object RulesetTransfer {
    const val MIME_TYPE = "application/json"

    private val PRETTY = Json(RulesJson) { prettyPrint = true }

    /** The configured set as a file name and its text, named by its last change. */
    fun fileName(ruleset: Ruleset): String = "monki-focus-rules-${ruleset.updatedAt.take(DATE_LENGTH)}.json"

    fun export(ruleset: Ruleset): String = PRETTY.encodeToString(Ruleset.serializer(), ruleset) + "\n"

    fun import(
        text: String,
        validator: RulesetValidator,
    ): ImportedRuleset {
        when (val verdict = validator.validateDocument(RulesetCheck.RULESET_SCHEMA, text)) {
            is ValidationResult.Rejected -> return ImportedRuleset.Invalid(verdict.code, locationOf(verdict.errors))
            ValidationResult.Valid -> Unit
        }
        return try {
            ImportedRuleset.Valid(RulesJson.decodeFromString(Ruleset.serializer(), text))
        } catch (_: SerializationException) {
            ImportedRuleset.Invalid(RejectionCode.SCHEMA, null)
        } catch (_: IllegalArgumentException) {
            ImportedRuleset.Invalid(RejectionCode.SCHEMA, null)
        }
    }

    /** Validator errors read `<pointer> <keyword>`; the pointer of the first one, when it is one. */
    private fun locationOf(errors: List<String>): String? =
        errors
            .firstOrNull()
            ?.substringBefore(' ')
            ?.takeIf { it.startsWith("$") || it.startsWith("/") }

    private const val DATE_LENGTH = 10
}
