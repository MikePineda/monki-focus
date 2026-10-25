// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.decision

import dev.monkifocus.android.core.domain.rules.AppTarget
import dev.monkifocus.android.core.domain.rules.CategoryAssignment
import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Ruleset

/**
 * A browser the packs cannot read (no URL bar ids for it) would otherwise
 * be a way around every site rule (docs/threat-model.md, "otro navegador").
 * While the rule set restricts anything on the web, `decide` runs for such a
 * browser with:
 *
 * - an enabled `friction` rule on the package, always (its own group id);
 * - a user category of level 0 for the package, so bedtime blocks it like
 *   any social app (on a tie a lower level wins, SEMANTICS.md §9).
 */
object UnsupportedBrowserRule {
    private const val ID_PREFIX = "unsupported-browser-"
    private const val MAX_ID_LENGTH = 64
    private const val CATEGORY = "browser/unsupported"

    fun idFor(packageName: String): String = (ID_PREFIX + packageName.replace('.', '-')).take(MAX_ID_LENGTH)

    fun addedTo(
        ruleset: Ruleset,
        packageName: String,
    ): Ruleset {
        val id = idFor(packageName)
        val target = AppTarget(packageName)
        val rules =
            if (ruleset.rules.any { it.id == id }) {
                ruleset.rules
            } else {
                ruleset.rules +
                    Rule(id, target, RuleMode.FRICTION, emptyList(), enabled = true)
            }
        return ruleset.copy(
            rules = rules,
            categories =
                listOf(CategoryAssignment(target, level = 0, category = CATEGORY)) + ruleset.categories,
        )
    }
}
