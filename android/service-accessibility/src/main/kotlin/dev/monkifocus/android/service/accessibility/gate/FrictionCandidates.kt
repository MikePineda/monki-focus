// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.gate

import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.engine.decide
import dev.monkifocus.android.core.domain.rules.Access
import dev.monkifocus.android.core.domain.rules.DecisionState
import dev.monkifocus.android.core.domain.rules.Observation
import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Ruleset

/**
 * The rules whose escalation a gate shares (SEMANTICS.md §7.4: the matching
 * friction candidates), found by asking the engine rather than matching
 * targets here, as the extension does: a rule is a friction candidate when,
 * alone in the rule set (no bedtime, no usage, no state), `decide` gates the
 * observation with it. Schedules, globs and the unknown-path promotion are
 * then exactly the engine's.
 */
object FrictionCandidates {
    private val QUIET_STATE = DecisionState(escalation = emptyList(), usage = null, unlocks = emptyList(), guardianLinked = false)

    fun of(
        ruleset: Ruleset,
        observation: Observation,
        now: String,
        catalog: RulesCatalog,
    ): List<Rule> {
        val bedtime = ruleset.bedtime.copy(enabled = false)
        return ruleset.rules.filter { rule ->
            if (!rule.enabled || rule.mode == RuleMode.ALLOW) return@filter false
            val alone = ruleset.copy(rules = listOf(rule), bedtime = bedtime)
            val decision = decide(alone, observation, QUIET_STATE, now, catalog)
            decision.access == Access.GATE && decision.ruleId == rule.id
        }
    }
}
