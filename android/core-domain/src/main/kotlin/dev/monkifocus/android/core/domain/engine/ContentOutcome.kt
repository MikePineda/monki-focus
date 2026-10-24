// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.Content
import dev.monkifocus.android.core.domain.rules.ReasonCode
import dev.monkifocus.android.core.domain.rules.Rule

/** The content axis of a decision (SEMANTICS.md §5.3) with the winner and reason it came from. */
internal data class ContentOutcome(
    val content: Content,
    /** The content winner, or null when no rule competes on this axis. */
    val winner: Rule?,
    /** `rule_match`, `permalink_never_hidden`, `path_unknown_allow` or `not_a_feed`. */
    val reason: ReasonCode,
)
