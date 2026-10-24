// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.Bedtime

/**
 * Bedtime changes (SEMANTICS.md §8): tightening iff bedtime becomes enabled,
 * or stays enabled with `days` and window whose week set contains the old
 * one. `warnMinutesBefore` is neutral; anything else waits.
 */
internal fun bedtimeChangeWaits(
    previous: Bedtime,
    next: Bedtime,
): Boolean {
    if (previous.copy(warnMinutesBefore = 0) == next.copy(warnMinutesBefore = 0)) return false
    if (!next.enabled) return true
    if (!previous.enabled) return false
    return !WeekSet.of(listOf(next)).contains(WeekSet.of(listOf(previous)))
}
