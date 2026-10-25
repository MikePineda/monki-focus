// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.transfer

import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.validation.RejectionCode

/** What reading a rule-set file gave: a valid set, or why nothing is imported. */
sealed interface ImportedRuleset {
    data class Valid(
        val ruleset: Ruleset,
    ) : ImportedRuleset

    /** Nothing partial is imported. [location] is the JSON pointer of the first failing field, when known (never a value). */
    data class Invalid(
        val code: RejectionCode,
        val location: String?,
    ) : ImportedRuleset
}
