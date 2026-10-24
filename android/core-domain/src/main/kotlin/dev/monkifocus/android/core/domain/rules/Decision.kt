// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.Serializable

/**
 * `decision.schema.json`: the output of `decide`. Two independent axes;
 * `ruleId`, `reason` and `explanationKey` describe the primary outcome
 * (SEMANTICS.md §5.4). `gate` is present iff access is `gate`.
 */
@Serializable
data class Decision(
    val access: Access,
    val content: Content,
    val ruleId: String?,
    val reason: ReasonCode,
    val gate: Gate? = null,
    val explanationKey: ExplanationKey,
)
