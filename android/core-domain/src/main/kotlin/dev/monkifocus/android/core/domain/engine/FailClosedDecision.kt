// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.Access
import dev.monkifocus.android.core.domain.rules.Content
import dev.monkifocus.android.core.domain.rules.Decision
import dev.monkifocus.android.core.domain.rules.DecisionState
import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.core.domain.rules.Observation
import dev.monkifocus.android.core.domain.rules.ReasonCode
import dev.monkifocus.android.core.domain.rules.Ruleset

/*
 * The public `decide` (SEMANTICS.md §14): fail closed. Any exception or
 * invalid input while deciding (malformed URL text, an instant without an
 * offset, an unresolvable time zone, an internal error) blocks and hides the
 * feed with reason `engine_error` and no gate, so a bug can never open what
 * the user chose to restrict. `validUntil` is null: there is no instant at
 * which the same broken inputs would decide better. The error itself is not exposed: adapters log
 * the reason code only, never URLs or titles.
 */

/** `{access: block, content: hide-feed, ruleId: null, reason: engine_error, validUntil: null}` without a gate. */
val ENGINE_ERROR_DECISION: Decision =
    Decision(
        access = Access.BLOCK,
        content = Content.HIDE_FEED,
        ruleId = null,
        reason = ReasonCode.ENGINE_ERROR,
        gate = null,
        explanationKey = ExplanationKey.ENGINE_ERROR,
        validUntil = null,
    )

/**
 * Decides what the user may see (SEMANTICS.md §5). Pure: `now` is an RFC 3339
 * instant from the injected clock (`instantOf(clock.millis())`), never read
 * here. Never throws.
 */
fun decide(
    ruleset: Ruleset,
    observation: Observation,
    state: DecisionState,
    now: String,
    catalog: RulesCatalog,
): Decision =
    try {
        decideOrThrow(ruleset, observation, state, now, catalog)
    } catch (_: Exception) {
        ENGINE_ERROR_DECISION
    } catch (_: StackOverflowError) {
        ENGINE_ERROR_DECISION
    }
