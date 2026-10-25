// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.decision

import dev.monkifocus.android.core.domain.rules.AppTarget
import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.SurfaceTarget
import dev.monkifocus.android.detectors.DetectorPack

/**
 * The app-level friction of the unclassified safety net (SEMANTICS.md §11):
 * when `UnclassifiedTimeCap` says it applies, `decide` runs with one more
 * rule, an enabled `friction` rule on the package, so the engine resolves it
 * like any other (bedtime, unlocks and specificity still apply) and its
 * escalation lives under its own group id.
 */
object UnclassifiedCapRule {
    private const val ID_PREFIX = "unclassified-cap-"
    private const val MAX_ID_LENGTH = 64

    /** The group id for [packageName]: matches `ruleId` (`[A-Za-z0-9][A-Za-z0-9_-]{0,63}`). */
    fun idFor(packageName: String): String = (ID_PREFIX + packageName.replace('.', '-')).take(MAX_ID_LENGTH)

    /** True when [ruleset] has an enabled surface `block` rule on a surface of [pack]'s family. */
    fun covers(
        ruleset: Ruleset,
        pack: DetectorPack,
    ): Boolean =
        ruleset.rules.any { rule ->
            val target = rule.target
            rule.enabled && rule.mode == RuleMode.BLOCK && target is SurfaceTarget && target.surface.substringBefore('.') == pack.packId
        }

    /** [ruleset] plus the cap rule for [packageName] (unchanged when a rule already uses that id). */
    fun addedTo(
        ruleset: Ruleset,
        packageName: String,
    ): Ruleset {
        val id = idFor(packageName)
        if (ruleset.rules.any { it.id == id }) return ruleset
        val rule = Rule(id = id, target = AppTarget(packageName), mode = RuleMode.FRICTION, schedules = emptyList(), enabled = true)
        return ruleset.copy(rules = ruleset.rules + rule)
    }
}
