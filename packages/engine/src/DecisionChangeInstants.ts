// SPDX-License-Identifier: AGPL-3.0-or-later
/**
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
import type { DecisionState, TimeZone } from '@monki-focus/rules'
import { minutesOfTimeOfDay, weekdayIndex, windowLengthMinutes } from './DailyWindow.ts'
import type { DailyWindowSpec } from './DailyWindow.ts'
import type { DecisionSubject } from './DecisionCandidates.ts'
import { SESSION_QUIET_SECONDS } from './EscalationSession.ts'
import { epochSecondsOf } from './Instant.ts'
import { zonesOf } from './PinnedTimeZones.ts'
import { resolveSchedules } from './ScheduleEvaluator.ts'
import {
  firstInstantReachingWall,
  localTimeAt,
  offsetTransitionsBetween,
  wallSecondsAt,
  wallSecondsOfDay,
  weekdayOfDay,
} from './ZonedTime.ts'

const SECONDS_PER_MINUTE = 60

/** More than any DST shift: walls beyond the horizon plus this cannot be reached in it. */
const MAX_WALL_SHIFT_SECONDS = 3 * 3600

/** Local days whose windows can reach into a 24-hour horizon (windows last at most a day). */
const DAYS_BEFORE = 1
const DAYS_AFTER = 2

function windowSpecsOf(subject: DecisionSubject): DailyWindowSpec[] {
  const { ruleset } = subject
  const schedules = subject.pool.flatMap((rule) =>
    resolveSchedules(rule.schedules, ruleset.workHours)
  )
  return ruleset.bedtime.enabled ? [...schedules, ruleset.bedtime] : schedules
}

/** Wall seconds of every window start and end, and of local midnights, around today. */
function boundaryWalls(specs: readonly DailyWindowSpec[], today: number): number[] {
  const walls: number[] = []
  for (let day = today - DAYS_BEFORE; day <= today + DAYS_AFTER; day += 1) {
    walls.push(wallSecondsOfDay(day))
    const weekday = weekdayOfDay(day)
    for (const spec of specs) {
      if (!spec.days.some((listed) => weekdayIndex(listed) === weekday)) continue
      const start = wallSecondsOfDay(day) + minutesOfTimeOfDay(spec.start) * SECONDS_PER_MINUTE
      walls.push(start, start + windowLengthMinutes(spec) * SECONDS_PER_MINUTE)
    }
  }
  return walls
}

function wallClockInstants(
  specs: readonly DailyWindowSpec[],
  zone: TimeZone,
  nowSeconds: number,
  horizon: number
): number[] {
  const transitions = offsetTransitionsBetween(nowSeconds, horizon, zone)
  const walls = boundaryWalls(specs, localTimeAt(nowSeconds, zone).dayNumber)
  const instants = [...transitions]
  // The wall clock is monotonic from each anchor to the next transition.
  for (const anchor of [nowSeconds, ...transitions]) {
    const anchorWall = wallSecondsAt(anchor, zone)
    const lastWall = anchorWall + (horizon - anchor) + MAX_WALL_SHIFT_SECONDS
    for (const wall of walls) {
      if (wall > anchorWall && wall <= lastWall) {
        instants.push(firstInstantReachingWall(anchor, wall, zone))
      }
    }
  }
  return instants
}

function stateInstants(state: DecisionState): number[] {
  const instants: number[] = []
  for (const unlock of state.unlocks) {
    instants.push(epochSecondsOf(unlock.notBefore), epochSecondsOf(unlock.expiresAt))
  }
  for (const escalation of state.escalation) {
    if (escalation.intentionExpiresAt !== null) {
      instants.push(epochSecondsOf(escalation.intentionExpiresAt))
    }
    if (escalation.overrideEndsAt !== null) instants.push(epochSecondsOf(escalation.overrideEndsAt))
    if (escalation.lastActivityAt !== null) {
      instants.push(epochSecondsOf(escalation.lastActivityAt) + SESSION_QUIET_SECONDS)
    }
  }
  return instants
}

/** Candidate instants in `(now, horizon]`, ascending and without repeats. */
export function changeInstants(
  subject: DecisionSubject,
  state: DecisionState,
  nowSeconds: number,
  horizon: number
): number[] {
  const specs = windowSpecsOf(subject)
  const instants = [
    ...stateInstants(state),
    ...zonesOf(subject.ruleset).flatMap((zone) =>
      wallClockInstants(specs, zone, nowSeconds, horizon)
    ),
  ]
  return [...new Set(instants)]
    .filter((instant) => instant > nowSeconds && instant <= horizon)
    .sort((a, b) => a - b)
}
