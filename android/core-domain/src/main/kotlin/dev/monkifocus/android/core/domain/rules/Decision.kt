// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.Serializable

/**
 * `decision.schema.json`: the output of `decide`. Two independent axes;
 * `ruleId`, `reason` and `explanationKey` describe the primary outcome
 * (SEMANTICS.md §5.4). `gate` is present iff access is `gate`. `validUntil`
 * (§5.6) is the earliest instant at which the same inputs can decide
 * differently, at most `now` + 24 h, in UTC; null only for `engine_error`.
 * It is required and always encoded, even when null.
 */
@Serializable
data class Decision(
    val access: Access,
    val content: Content,
    val ruleId: String?,
    val reason: ReasonCode,
    val gate: Gate? = null,
    val explanationKey: ExplanationKey,
    val validUntil: String?,
)
