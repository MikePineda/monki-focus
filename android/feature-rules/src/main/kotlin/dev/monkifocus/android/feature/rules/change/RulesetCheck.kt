// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.change

import dev.monkifocus.android.core.domain.rules.RulesJson
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.validation.RulesetValidator
import dev.monkifocus.android.core.domain.validation.ValidationResult

/** Validates a whole rule set as it would be stored (schema, `x-*` keywords and the 256 KiB limit). */
fun interface RulesetCheck {
    fun check(ruleset: Ruleset): ValidationResult

    companion object {
        const val RULESET_SCHEMA = "ruleset"

        /** The rule set encoded as stored, then validated as a `ruleset` document. */
        fun of(validator: RulesetValidator): RulesetCheck =
            RulesetCheck { ruleset ->
                validator.validateDocument(RULESET_SCHEMA, RulesJson.encodeToString(Ruleset.serializer(), ruleset))
            }
    }
}
