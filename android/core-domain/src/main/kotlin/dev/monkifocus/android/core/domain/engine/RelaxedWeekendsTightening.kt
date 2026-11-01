// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.RelaxedWeekends

/**
 * `relaxedWeekends` changes (SEMANTICS.md §8): tightening iff it ends
 * disabled (absent counts as disabled) or is unchanged; turning it on is
 * loosening and waits.
 */
internal fun relaxedWeekendsChangeWaits(
    previous: RelaxedWeekends?,
    next: RelaxedWeekends?,
): Boolean {
    if (next == null || !next.enabled) return false
    return previous != next
}
