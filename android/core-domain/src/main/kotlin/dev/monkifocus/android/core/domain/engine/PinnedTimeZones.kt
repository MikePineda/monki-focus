// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Ruleset

/*
 * The pinned time zone (SEMANTICS.md §6.3). `ruleset.timeZone` is the only
 * zone; while a change of zone waits the set also carries `pendingTimeZone`
 * and every schedule is evaluated in both with the stricter outcome winning:
 * a restrictive rule is active when it is active in either zone, an `allow`
 * rule only when it is active in both. The device zone is never an input.
 */

internal fun zonesOf(
    timeZone: String,
    pendingTimeZone: String?,
): List<String> = if (pendingTimeZone == null || pendingTimeZone == timeZone) listOf(timeZone) else listOf(timeZone, pendingTimeZone)

internal fun zonesOf(ruleset: Ruleset): List<String> = zonesOf(ruleset.timeZone, ruleset.pendingTimeZone)

/** Whether the rule's schedules make it active at the instant, in the pinned zone(s). */
internal fun isRuleScheduledAt(
    rule: Rule,
    ruleset: Ruleset,
    epochSeconds: Long,
): Boolean {
    fun activeIn(zone: String) = isScheduleActiveAt(rule.schedules, ruleset.workHours, epochSeconds, zone)
    val zones = zonesOf(ruleset)
    return if (rule.mode == RuleMode.ALLOW) zones.all(::activeIn) else zones.any(::activeIn)
}

/** Today's local date in each pinned zone (budget days, §5.2.2). */
internal fun localDatesAt(
    ruleset: Ruleset,
    epochSeconds: Long,
): List<String> = zonesOf(ruleset).map { zone -> localTimeAt(epochSeconds, zone).localDate }
