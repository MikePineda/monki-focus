// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.DailyWindowSpec
import dev.monkifocus.android.core.domain.rules.Rule
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.Schedule

/*
 * `effectiveRuleSet(old, new, now, pendingEffectiveFrom, catalog) →
 * {effectiveToday, effectiveFrom}` (SEMANTICS.md §8). `old` is the currently
 * effective set. A change that only tightens applies at once; anything else
 * waits for the next local midnight (or the end of an old window running
 * then) and never earlier than a pending change. Each part (rule by id,
 * bedtime, work hours, time zone, category by target) is judged on its own.
 */

private data class RulePart(
    val id: String,
    val previous: Rule?,
    val next: Rule?,
    val verdict: RuleVerdict,
) {
    /** The rule of the part as it applies today: `new` when the part applies, else `old`. */
    fun today(applies: Boolean): Rule? = if (applies) next else previous
}

/**
 * Parts that tighten by the field rules, then the outrank check against what
 * would actually apply now, iterated to a fixed point (§8).
 */
private fun applicableRuleIds(
    parts: List<RulePart>,
    workHoursToday: Schedule,
    catalog: RulesCatalog,
): Set<String> {
    val applicable = parts.filter { it.verdict.tightens }.map { it.id }.toMutableSet()
    while (true) {
        val today = parts.mapNotNull { it.today(it.id in applicable) }
        val failing =
            parts.filter { part ->
                part.id in applicable &&
                    part.verdict.activates &&
                    part.next != null &&
                    !passesOutrankCheck(part.next, today, workHoursToday, catalog)
            }
        if (failing.isEmpty()) return applicable
        failing.forEach { applicable.remove(it.id) }
    }
}

/**
 * `{ref: "workHours"}` resolves to `old.workHours` in the old rule and to the
 * work hours that apply today in the new one (§8).
 */
private fun ruleParts(
    old: Ruleset,
    next: Ruleset,
    workHoursToday: Schedule,
    catalog: RulesCatalog,
): List<RulePart> {
    val previousById = old.rules.associateBy { it.id }
    val nextById = next.rules.associateBy { it.id }
    val ids = (previousById.keys + nextById.keys).sorted()
    val workHours = WorkHoursPair(old.workHours, workHoursToday)
    return ids.map { id ->
        val previous = previousById[id]
        val rule = nextById[id]
        val unchanged = previous != null && rule != null && previous == rule
        val verdict =
            if (unchanged) {
                RuleVerdict(
                    tightens = true,
                    activates = false,
                )
            } else {
                judgeRuleChange(previous, rule, workHours, catalog)
            }
        RulePart(id, previous, rule, verdict)
    }
}

/**
 * Whether the old schedule windows of a waiting rule must run to their end
 * (§8 step 2): its `schedules` changed, or it is an enabled non-allow rule
 * that is removed or disabled (deleting a block during its window waits).
 */
private fun windowRunsOut(part: RulePart): Boolean {
    val previous = part.previous ?: return false
    val next = part.next
    if (next != null && previous.schedules != next.schedules) return true
    val stopsApplying = next == null || !next.enabled
    return stopsApplying && previous.enabled && previous.mode != RuleMode.ALLOW
}

fun effectiveRuleSet(
    old: Ruleset,
    next: Ruleset,
    now: String,
    pendingEffectiveFrom: String?,
    catalog: RulesCatalog,
): EffectiveRuleSet {
    val timeZoneWaits = old.timeZone != next.timeZone
    val workHoursWait = old.workHours != next.workHours
    val bedtimeWaits = bedtimeChangeWaits(old.bedtime, next.bedtime)
    val categories = planCategories(old.categories, next.categories, catalog)
    val workHoursToday = if (workHoursWait) old.workHours else next.workHours
    val parts = ruleParts(old, next, workHoursToday, catalog)
    val applicable = applicableRuleIds(parts, workHoursToday, catalog)
    val waitingRules = parts.filter { it.id !in applicable }

    val somethingWaits = timeZoneWaits || workHoursWait || bedtimeWaits || categories.waits || waitingRules.isNotEmpty()
    if (!somethingWaits) return EffectiveRuleSet(next, null)

    val effectiveToday =
        next.copy(
            // A waiting zone change keeps the old zone and evaluates the new one alongside it (§6.3).
            timeZone = if (timeZoneWaits) old.timeZone else next.timeZone,
            pendingTimeZone = if (timeZoneWaits) next.timeZone else next.pendingTimeZone,
            // Parts are in id order, so the rules are sorted by id (§8).
            rules = parts.mapNotNull { it.today(it.id in applicable) },
            categories = categories.categoriesToday,
            bedtime = if (bedtimeWaits) old.bedtime else next.bedtime,
            workHours = workHoursToday,
        )

    // §8 step 2: old windows of the waiting parts that must run to their end.
    val windows = mutableListOf<DailyWindowSpec>()
    if ((bedtimeWaits || categories.waits || timeZoneWaits) && old.bedtime.enabled) windows += old.bedtime
    if (workHoursWait) windows += old.workHours
    val windowedOldRules =
        if (timeZoneWaits) {
            old.rules.filter { it.enabled }
        } else {
            waitingRules.filter(::windowRunsOut).mapNotNull { it.previous }
        }
    for (rule in windowedOldRules) windows += resolveSchedules(rule.schedules, old.workHours)

    val zones = if (timeZoneWaits) listOf(old.timeZone, next.timeZone) else listOf(old.timeZone)
    val pending = pendingEffectiveFrom?.let(::epochSecondsOf)
    val effectiveFrom = effectiveFromOf(epochSecondsOf(now), zones, windows, pending)
    return EffectiveRuleSet(effectiveToday, utcInstantOf(effectiveFrom))
}
