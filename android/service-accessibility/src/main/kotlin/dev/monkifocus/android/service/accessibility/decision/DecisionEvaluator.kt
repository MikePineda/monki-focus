// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.decision

import dev.monkifocus.android.core.domain.engine.ENGINE_ERROR_DECISION
import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.engine.decide
import dev.monkifocus.android.core.domain.engine.instantOf
import dev.monkifocus.android.core.domain.rules.Observation

/**
 * Runs the engine's fail-closed `decide` (SEMANTICS.md §14) for one
 * observation. The wall clock is a parameter: the service passes
 * `System.currentTimeMillis()`, turned into an instant with `instantOf`.
 * Without a rule set (storage could not be read) it fails closed the same
 * way the engine does.
 */
class DecisionEvaluator(
    private val catalog: RulesCatalog,
) {
    fun evaluate(
        snapshot: ProtectionSnapshot?,
        observation: Observation,
        capPackage: String?,
        nowEpochMs: Long,
    ): Evaluation {
        if (snapshot == null) return Evaluation(ENGINE_ERROR_DECISION, null, observation)
        val ruleset = capPackage?.let { UnclassifiedCapRule.addedTo(snapshot.ruleset, it) } ?: snapshot.ruleset
        val decision = decide(ruleset, observation, snapshot.decisionState, instantOf(nowEpochMs), catalog)
        return Evaluation(decision, ruleset, observation)
    }
}
