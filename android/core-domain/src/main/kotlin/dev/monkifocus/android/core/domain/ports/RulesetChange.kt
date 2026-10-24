// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

import dev.monkifocus.android.core.domain.engine.EffectiveRuleSet
import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.rules.Ruleset

/**
 * One edit of the rule set as `effectiveRuleSet(old, next, now,
 * pendingEffectiveFrom)` judged it (SEMANTICS.md §8): [effectiveToday] applies
 * at once and [next] applies from [effectiveFrom]. When nothing waits,
 * [effectiveFrom] is null and [effectiveToday] equals [next].
 */
data class RulesetChange(
    val effectiveToday: Ruleset,
    val next: Ruleset,
    val effectiveFrom: String?,
    val source: RulesetSource,
) {
    init {
        effectiveFrom?.let(::epochSecondsOf)
        require(effectiveFrom != null || effectiveToday == next) { "Without effectiveFrom the change applies whole" }
    }

    companion object {
        /** The change for [next] given the engine's verdict on it. */
        fun of(
            next: Ruleset,
            verdict: EffectiveRuleSet,
            source: RulesetSource,
        ): RulesetChange = RulesetChange(verdict.effectiveToday, next, verdict.effectiveFrom, source)
    }
}
