// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Schedule

/*
 * The field rules of SEMANTICS.md §8 for one rule id: whether a change only
 * tightens, and whether the rule becomes active where it was not (added,
 * enabled, schedule widened), which also needs the outrank check.
 *
 * - Added: tightening iff enabled and not `allow` (outrank check).
 * - Removed: tightening iff it was an enabled `allow` rule without a budget.
 * - Modified: tightening iff every changed field tightens: target unchanged;
 *   `enabled` false → true for a non-allow rule (outrank check) or true →
 *   false for an allow rule without a budget; mode `allow → any`,
 *   `friction → block`, `hide-feed → block`; on a non-allow rule, schedules
 *   whose week set contains the old one (outrank check when it grows); a
 *   budget added or lowered; `note` is neutral.
 */

internal data class RuleVerdict(
    val tightens: Boolean,
    /** Becomes active where it was not: tightening only if it passes the outrank check. */
    val activates: Boolean,
)

internal data class WorkHoursPair(
    val previous: Schedule,
    val next: Schedule,
)

private fun modeTightens(
    previous: Rule,
    next: Rule,
): Boolean =
    previous.mode == next.mode ||
        previous.mode == RuleMode.ALLOW ||
        (next.mode == RuleMode.BLOCK && (previous.mode == RuleMode.FRICTION || previous.mode == RuleMode.HIDE_FEED))

private fun budgetTightens(
    previous: Rule,
    next: Rule,
): Boolean {
    val before = previous.dailyBudgetMinutes
    val after = next.dailyBudgetMinutes
    if (before == after) return true
    return after != null && (before == null || after < before)
}

private fun isPlainAllow(rule: Rule): Boolean = rule.mode == RuleMode.ALLOW && rule.dailyBudgetMinutes == null

private fun judgeModified(
    previous: Rule,
    next: Rule,
    workHours: WorkHoursPair,
    catalog: RulesCatalog,
): RuleVerdict {
    // Targets compared after §3.1 normalisation (domain, case-insensitive glob, the catch-all glob as no path).
    var tightens = canonicalTargetKey(previous.target, catalog) == canonicalTargetKey(next.target, catalog)
    var activates = false
    if (previous.enabled != next.enabled) {
        if (next.enabled) {
            tightens = tightens && next.mode != RuleMode.ALLOW
            activates = true
        } else {
            tightens = tightens && isPlainAllow(previous)
        }
    }
    tightens = tightens && modeTightens(previous, next) && budgetTightens(previous, next)
    if (previous.schedules != next.schedules) {
        val before = WeekSet.of(resolveSchedules(previous.schedules, workHours.previous))
        val after = WeekSet.of(resolveSchedules(next.schedules, workHours.next))
        tightens = tightens && next.mode != RuleMode.ALLOW && after.contains(before)
        activates = activates || after != before
    }
    return RuleVerdict(tightens, activates && next.enabled)
}

internal fun judgeRuleChange(
    previous: Rule?,
    next: Rule?,
    workHours: WorkHoursPair,
    catalog: RulesCatalog,
): RuleVerdict =
    when {
        previous == null -> {
            val added = requireNotNull(next) { "A rule part has an old or a new rule" }
            RuleVerdict(added.enabled && added.mode != RuleMode.ALLOW, added.enabled)
        }

        next == null -> {
            RuleVerdict(previous.enabled && isPlainAllow(previous), activates = false)
        }

        else -> {
            judgeModified(previous, next, workHours, catalog)
        }
    }
