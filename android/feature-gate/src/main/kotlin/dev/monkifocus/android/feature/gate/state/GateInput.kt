// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate.state

import dev.monkifocus.android.core.domain.rules.Decision
import dev.monkifocus.android.core.domain.rules.EscalationState

/**
 * Everything [GateUiStateMapper] needs, passed in by the overlay adapter.
 * The clock is a parameter ([nowEpochSeconds] from the injected clock),
 * never read here.
 */
data class GateInput(
    val decision: Decision,
    /** The escalation state of the decision's group (the rule id, or `bedtime`); null when none is stored yet. */
    val escalation: EscalationState?,
    val nowEpochSeconds: Long,
    /** The app label or domain the user is opening (data, not catalog copy). */
    val targetLabel: String,
    val guardianLinked: Boolean = false,
    /** The last intention the user typed for this group, so a new one must differ (L2+). */
    val previousIntention: String? = null,
    /** The intention that just ran out, for the timeout card. Kept on the device only. */
    val timedOutIntention: String? = null,
    /** The minutes the user chose for that intention. */
    val timedOutMinutes: Int? = null,
    /** Local end of the bedtime window (minute of day, 0…1439), when bedtime is on. */
    val bedtimeEndMinuteOfDay: Int? = null,
)
