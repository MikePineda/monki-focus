// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Schedule

/*
 * The outrank check (SEMANTICS.md §8): a rule that becomes active where it
 * was not is tightening only if, at every instant it is active, it does not
 * outrank (§4, access axis) an overlapping rule of what applies today with a
 * stricter mode (`block` above `friction`). Otherwise a friction rule more
 * specific than a block would turn the block into a gate.
 */

/** Access-axis strictness; `hide-feed` does not compete for access. */
private fun accessStrictness(mode: RuleMode): Int? =
    when (mode) {
        RuleMode.ALLOW -> 0
        RuleMode.FRICTION -> 1
        RuleMode.BLOCK -> 2
        RuleMode.HIDE_FEED -> null
    }

internal fun passesOutrankCheck(
    rule: Rule,
    applyingToday: List<Rule>,
    workHours: Schedule,
    catalog: RulesCatalog,
): Boolean {
    val strictness = accessStrictness(rule.mode) ?: return true
    val week = WeekSet.of(resolveSchedules(rule.schedules, workHours))
    return applyingToday.none { other ->
        val otherStrictness = accessStrictness(other.mode)
        other.id != rule.id &&
            other.enabled &&
            otherStrictness != null &&
            otherStrictness > strictness &&
            targetsOverlap(rule.target, other.target, catalog) &&
            week.intersects(WeekSet.of(resolveSchedules(other.schedules, workHours))) &&
            outranks(rule, other, catalog)
    }
}
