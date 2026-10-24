// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The outrank check (SEMANTICS.md §8): a rule that becomes active where it
 * was not is tightening only if, at every instant it is active, it does not
 * outrank (§4, access axis) an overlapping rule of what applies today with a
 * stricter mode (`block` above `friction`). Otherwise a friction rule more
 * specific than a block would turn the block into a gate.
 */
import type { Rule, Schedule } from '@monki-focus/rules'
import type { RulesCatalog } from './RulesCatalog.ts'
import { resolveSchedules } from './ScheduleEvaluator.ts'
import { outranks } from './Specificity.ts'
import { targetsOverlap } from './TargetOverlap.ts'
import { weekSetOf, weekSetsIntersect } from './WeekSet.ts'

/** Access-axis strictness; `hide-feed` does not compete for access. */
const ACCESS_STRICTNESS: Readonly<Partial<Record<Rule['mode'], number>>> = {
  allow: 0,
  friction: 1,
  block: 2,
}

export function passesOutrankCheck(
  rule: Rule,
  applyingToday: readonly Rule[],
  workHours: Schedule,
  catalog: RulesCatalog
): boolean {
  const strictness = ACCESS_STRICTNESS[rule.mode]
  if (strictness === undefined) return true
  const week = weekSetOf(resolveSchedules(rule.schedules, workHours))
  return !applyingToday.some((other) => {
    const otherStrictness = ACCESS_STRICTNESS[other.mode]
    return (
      other.id !== rule.id &&
      other.enabled &&
      otherStrictness !== undefined &&
      otherStrictness > strictness &&
      targetsOverlap(rule.target, other.target, catalog) &&
      weekSetsIntersect(week, weekSetOf(resolveSchedules(other.schedules, workHours))) &&
      outranks(rule, other, catalog)
    )
  })
}
