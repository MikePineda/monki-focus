// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.fixtures

import dev.monkifocus.android.core.domain.engine.EffectiveRuleSet
import dev.monkifocus.android.core.domain.engine.EscalationResult
import dev.monkifocus.android.core.domain.rules.Decision
import dev.monkifocus.android.core.domain.rules.DecisionState
import dev.monkifocus.android.core.domain.rules.EscalationEvent
import dev.monkifocus.android.core.domain.rules.EscalationState
import dev.monkifocus.android.core.domain.rules.Observation
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.UrlNormalization
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/*
 * Fixture shapes mirroring the `<kind>-fixture.schema.json` files. They decode with
 * the strict `RulesJson`, so a field the Kotlin models do not know fails the
 * runner instead of being ignored.
 */

@Serializable
data class DecisionFixture(
    val id: String,
    val kind: String,
    val description: String,
    val given: Given,
    @SerialName("when") val whenever: When,
    val then: Decision,
) {
    @Serializable
    data class Given(
        val ruleset: Ruleset,
        val now: String,
        val state: DecisionState,
    )

    @Serializable
    data class When(
        val target: Observation,
    )
}

@Serializable
data class UrlNormalizeFixture(
    val id: String,
    val kind: String,
    val description: String,
    val given: Given,
    val then: UrlNormalization,
) {
    @Serializable
    data class Given(
        val urlText: String,
    )
}

@Serializable
data class EscalationFixture(
    val id: String,
    val kind: String,
    val description: String,
    val given: Given,
    val steps: List<Step>,
) {
    @Serializable
    data class Given(
        val state: EscalationState,
        val guardianLinked: Boolean,
    )

    @Serializable
    data class Step(
        val at: String,
        val event: EscalationEvent,
        val then: EscalationResult,
    )
}

@Serializable
data class RuleChangeFixture(
    val id: String,
    val kind: String,
    val description: String,
    val given: Given,
    val then: EffectiveRuleSet,
) {
    @Serializable
    data class Given(
        val old: Ruleset,
        val new: Ruleset,
        val now: String,
        val pendingEffectiveFrom: String?,
    )
}

/** A document every validator must reject, with its code; `document` stays raw JSON on purpose. */
@Serializable
data class InvalidFixture(
    val id: String,
    val kind: String,
    val description: String,
    val schema: String,
    val document: JsonElement,
    val then: Then,
) {
    @Serializable
    data class Then(
        val rejected: Boolean,
        val code: String,
    )
}
