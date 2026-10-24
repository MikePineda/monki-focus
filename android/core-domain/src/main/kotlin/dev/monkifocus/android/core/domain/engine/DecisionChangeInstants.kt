// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.DailyWindowSpec
import dev.monkifocus.android.core.domain.rules.DecisionState

/*
 * The instants in `(now, horizon]` at which a decision with fixed inputs can
 * change (SEMANTICS.md §5.6). Between two consecutive ones every
 * time-dependent check of `decide` keeps its value:
 *
 * - wall-clock boundaries in each pinned zone: the start and end of every
 *   schedule window of a pool rule (`workHours` resolved), of the bedtime
 *   window, and local midnights (the budget day); a boundary in a
 *   spring-forward gap is reached at the first instant after the gap, and
 *   one in a repeated fall-back hour is reached once per pass;
 * - the zone's offset transitions themselves (a fall-back puts the wall clock
 *   back inside or outside a window);
 * - instants of the state: unlock `notBefore` and `expiresAt`, intention and
 *   override ends, and `lastActivityAt + 2 h` (the session reset of §7.2
 *   changes the next gate).
 *
 * A superset is harmless: `validUntil` keeps the first candidate at which the
 * decision really differs.
 */

private const val SECONDS_PER_MINUTE = 60L

/** More than any DST shift: walls beyond the horizon plus this cannot be reached in it. */
private const val MAX_WALL_SHIFT_SECONDS = 3 * 3600L

/** Local days whose windows can reach into a 24-hour horizon (windows last at most a day). */
private const val DAYS_BEFORE = 1L
private const val DAYS_AFTER = 2L

private fun windowSpecsOf(subject: DecisionSubject): List<DailyWindowSpec> {
    val ruleset = subject.ruleset
    val schedules = subject.pool.flatMap { rule -> resolveSchedules(rule.schedules, ruleset.workHours) }
    return if (ruleset.bedtime.enabled) schedules + ruleset.bedtime else schedules
}

/** Wall seconds of every window start and end, and of local midnights, around today. */
private fun boundaryWalls(
    specs: List<DailyWindowSpec>,
    today: Long,
): List<Long> {
    val walls = mutableListOf<Long>()
    for (day in (today - DAYS_BEFORE)..(today + DAYS_AFTER)) {
        walls += wallSecondsOfDay(day)
        val weekday = weekdayOfDay(day)
        for (spec in specs) {
            if (spec.days.none { it.ordinal == weekday }) continue
            val start = wallSecondsOfDay(day) + minutesOfTimeOfDay(spec.start) * SECONDS_PER_MINUTE
            walls += start
            walls += start + windowLengthMinutes(spec) * SECONDS_PER_MINUTE
        }
    }
    return walls
}

private fun wallClockInstants(
    specs: List<DailyWindowSpec>,
    zone: String,
    nowSeconds: Long,
    horizon: Long,
): List<Long> {
    val transitions = offsetTransitionsBetween(nowSeconds, horizon, zone)
    val walls = boundaryWalls(specs, localTimeAt(nowSeconds, zone).dayNumber)
    val instants = transitions.toMutableList()
    // The wall clock is monotonic from each anchor to the next transition.
    for (anchor in listOf(nowSeconds) + transitions) {
        val anchorWall = wallSecondsAt(anchor, zone)
        val lastWall = anchorWall + (horizon - anchor) + MAX_WALL_SHIFT_SECONDS
        for (wall in walls) {
            if (wall > anchorWall && wall <= lastWall) instants += firstInstantReachingWall(anchor, wall, zone)
        }
    }
    return instants
}

private fun stateInstants(state: DecisionState): List<Long> {
    val instants = mutableListOf<Long>()
    for (unlock in state.unlocks) {
        instants += epochSecondsOf(unlock.notBefore)
        instants += epochSecondsOf(unlock.expiresAt)
    }
    for (escalation in state.escalation) {
        escalation.intentionExpiresAt?.let { instants += epochSecondsOf(it) }
        escalation.overrideEndsAt?.let { instants += epochSecondsOf(it) }
        escalation.lastActivityAt?.let { instants += epochSecondsOf(it) + SESSION_QUIET_SECONDS }
    }
    return instants
}

/** Candidate instants in `(now, horizon]`, ascending and without repeats. */
internal fun changeInstants(
    subject: DecisionSubject,
    state: DecisionState,
    nowSeconds: Long,
    horizon: Long,
): List<Long> {
    val specs = windowSpecsOf(subject)
    val instants = stateInstants(state) + zonesOf(subject.ruleset).flatMap { zone -> wallClockInstants(specs, zone, nowSeconds, horizon) }
    return instants
        .toSet()
        .filter { instant -> instant > nowSeconds && instant <= horizon }
        .sorted()
}
