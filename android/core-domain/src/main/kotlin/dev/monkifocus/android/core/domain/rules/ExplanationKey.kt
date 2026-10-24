// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * `decision.schema.json#/$defs/explanationKey`: the i18n key of a decision
 * (SEMANTICS.md §5.4). The domain never returns text; `key` is the string
 * catalog key.
 */
@Serializable
enum class ExplanationKey(
    val key: String,
) {
    @SerialName("decision.no_rule")
    NO_RULE("decision.no_rule"),

    @SerialName("decision.allowed_by_rule")
    ALLOWED_BY_RULE("decision.allowed_by_rule"),

    @SerialName("decision.blocked_by_rule")
    BLOCKED_BY_RULE("decision.blocked_by_rule"),

    @SerialName("decision.feed_hidden")
    FEED_HIDDEN("decision.feed_hidden"),

    @SerialName("decision.intention_required")
    INTENTION_REQUIRED("decision.intention_required"),

    @SerialName("decision.intention_active")
    INTENTION_ACTIVE("decision.intention_active"),

    @SerialName("decision.schedule_bedtime")
    SCHEDULE_BEDTIME("decision.schedule_bedtime"),

    @SerialName("decision.budget_exhausted")
    BUDGET_EXHAUSTED("decision.budget_exhausted"),

    @SerialName("decision.unlock_active")
    UNLOCK_ACTIVE("decision.unlock_active"),

    @SerialName("decision.emergency_active")
    EMERGENCY_ACTIVE("decision.emergency_active"),

    @SerialName("decision.permalink_never_hidden")
    PERMALINK_NEVER_HIDDEN("decision.permalink_never_hidden"),

    @SerialName("decision.path_unknown_allow")
    PATH_UNKNOWN_ALLOW("decision.path_unknown_allow"),

    @SerialName("decision.not_a_feed")
    NOT_A_FEED("decision.not_a_feed"),

    @SerialName("decision.engine_error")
    ENGINE_ERROR("decision.engine_error"),

    ;

    companion object {
        /** `decision.<reason>` for every reason but `rule_match`, whose key depends on the outcome. */
        fun ofReason(reason: ReasonCode): ExplanationKey = entries.first { it.key == "decision.${reason.code}" }
    }
}
