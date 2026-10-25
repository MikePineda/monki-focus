// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.decision

import dev.monkifocus.android.core.domain.rules.EscalationState
import dev.monkifocus.android.core.domain.rules.Ruleset

/**
 * Holds the current [ProtectionSnapshot]. Before the first load there is
 * nothing to decide with and the pipeline waits; when loading failed the
 * pipeline fails closed (`engine_error`) on every target, as `decide` would.
 * Main thread only.
 */
class SnapshotHolder {
    var snapshot: ProtectionSnapshot? = null
        private set

    /** True when the stored rules could not be read: decide fails closed. */
    var loadFailed: Boolean = false
        private set

    /** A fresh rule set from storage; the escalation already in memory is kept (this service wrote it). */
    fun loaded(
        ruleset: Ruleset,
        storedEscalation: List<EscalationState>,
    ) {
        val current = snapshot
        snapshot =
            if (current == null) {
                ProtectionSnapshot(ruleset, storedEscalation)
            } else {
                current.copy(ruleset = ruleset)
            }
        loadFailed = false
    }

    fun failed() {
        if (snapshot == null) loadFailed = true
    }

    fun update(state: EscalationState) {
        snapshot = snapshot?.with(state)
    }
}
