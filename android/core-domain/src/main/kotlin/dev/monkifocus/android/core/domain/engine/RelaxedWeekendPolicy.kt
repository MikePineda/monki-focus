// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.SurfaceTarget

/*
 * Relaxed weekends (SEMANTICS.md §6.4), a softer weekend chosen by the user:
 *
 * - a **relaxed night** is a bedtime window that starts on a Friday or a
 *   Saturday (local start day), after midnight included; bedtime is in one
 *   when it is active in at least one pinned zone and, in every zone where it
 *   is active, the active window started on a Friday or Saturday. Bedtime then
 *   asks for an intention instead of blocking (§5.2 step 4);
 * - a **relaxed day** is a Saturday or Sunday in every pinned zone. On one, a
 *   `block` or `hide-feed` rule on a short-video surface takes part as
 *   `friction` (§5.1).
 */

private const val FRIDAY = 4
private const val SATURDAY = 5
private const val SUNDAY = 6

private fun isEnabled(ruleset: Ruleset): Boolean = ruleset.relaxedWeekends?.enabled == true

/** Whether `now` is a relaxed night: bedtime is active and every active window started on a Friday or Saturday. */
internal fun isRelaxedNightAt(
    ruleset: Ruleset,
    epochSeconds: Long,
): Boolean {
    if (!isEnabled(ruleset) || !ruleset.bedtime.enabled) return false
    val occurrences = zonesOf(ruleset).mapNotNull { zone -> occurrenceAt(ruleset.bedtime, localTimeAt(epochSeconds, zone)) }
    return occurrences.isNotEmpty() &&
        occurrences.all { weekdayOfDay(it.startDayNumber) == FRIDAY || weekdayOfDay(it.startDayNumber) == SATURDAY }
}

/** Whether `now` is a relaxed day: a Saturday or Sunday in every pinned zone. */
internal fun isRelaxedDayAt(
    ruleset: Ruleset,
    epochSeconds: Long,
): Boolean =
    isEnabled(ruleset) &&
        zonesOf(ruleset).all { zone ->
            val weekday = localTimeAt(epochSeconds, zone).weekday
            weekday == SATURDAY || weekday == SUNDAY
        }

/** The rule as it takes part on a relaxed day: a short-video `block` or `hide-feed` counts as `friction`. */
internal fun relaxedDayRule(
    rule: Rule,
    catalog: RulesCatalog,
): Rule {
    val target = rule.target
    val softened = rule.mode == RuleMode.BLOCK || rule.mode == RuleMode.HIDE_FEED
    return if (softened && target is SurfaceTarget && catalog.isShortVideo(target.surface)) rule.copy(mode = RuleMode.FRICTION) else rule
}
