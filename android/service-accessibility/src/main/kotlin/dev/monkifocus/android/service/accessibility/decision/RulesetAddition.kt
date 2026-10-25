// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.decision

import dev.monkifocus.android.core.domain.rules.Ruleset

/** A rule the service adds to the user's rule set for one decision, so the engine resolves it like any other. */
sealed interface RulesetAddition {
    fun applyTo(ruleset: Ruleset): Ruleset

    /** The unclassified safety net applies to [packageName] ([UnclassifiedCapRule]). */
    data class UnclassifiedCap(
        val packageName: String,
    ) : RulesetAddition {
        override fun applyTo(ruleset: Ruleset): Ruleset = UnclassifiedCapRule.addedTo(ruleset, packageName)
    }

    /** [packageName] is a browser the packs cannot read ([UnsupportedBrowserRule]). */
    data class UnsupportedBrowser(
        val packageName: String,
    ) : RulesetAddition {
        override fun applyTo(ruleset: Ruleset): Ruleset = UnsupportedBrowserRule.addedTo(ruleset, packageName)
    }
}
