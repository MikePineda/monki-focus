// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** `decision.schema.json#/$defs/reasonCode`: why a decision came out as it did. Adapters log only this. */
@Serializable
enum class ReasonCode(
    /** The wire name, also the suffix of the `decision.<reason>` explanation key. */
    val code: String,
) {
    @SerialName("no_rule")
    NO_RULE("no_rule"),

    @SerialName("rule_match")
    RULE_MATCH("rule_match"),

    @SerialName("intention_required")
    INTENTION_REQUIRED("intention_required"),

    @SerialName("intention_active")
    INTENTION_ACTIVE("intention_active"),

    @SerialName("schedule_bedtime")
    SCHEDULE_BEDTIME("schedule_bedtime"),

    @SerialName("budget_exhausted")
    BUDGET_EXHAUSTED("budget_exhausted"),

    @SerialName("unlock_active")
    UNLOCK_ACTIVE("unlock_active"),

    @SerialName("emergency_active")
    EMERGENCY_ACTIVE("emergency_active"),

    @SerialName("permalink_never_hidden")
    PERMALINK_NEVER_HIDDEN("permalink_never_hidden"),

    @SerialName("path_unknown_allow")
    PATH_UNKNOWN_ALLOW("path_unknown_allow"),

    @SerialName("not_a_feed")
    NOT_A_FEED("not_a_feed"),

    @SerialName("engine_error")
    ENGINE_ERROR("engine_error"),
}
