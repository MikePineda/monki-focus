// SPDX-License-Identifier: AGPL-3.0-or-later
/**
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
import type { Rule, Schedule, Target } from '@monki-focus/rules'
import { canonicalTargetKey } from './CanonicalTarget.ts'
import { jsonEqual } from './JsonEquality.ts'
import type { RulesCatalog } from './RulesCatalog.ts'
import { resolveSchedules } from './ScheduleEvaluator.ts'
import { weekSetContains, weekSetOf, weekSetsEqual } from './WeekSet.ts'

export interface RuleVerdict {
  tightens: boolean
  /** Becomes active where it was not: tightening only if it passes the outrank check. */
  activates: boolean
}

export interface WorkHoursPair {
  previous: Schedule
  next: Schedule
}

/** Targets compared after §3.1 normalisation (domain, case-insensitive glob, `/**` as no path). */
function sameTarget(a: Target, b: Target, catalog: RulesCatalog): boolean {
  return canonicalTargetKey(a, catalog) === canonicalTargetKey(b, catalog)
}

function modeTightens(previous: Rule, next: Rule): boolean {
  return (
    previous.mode === next.mode ||
    previous.mode === 'allow' ||
    (next.mode === 'block' && (previous.mode === 'friction' || previous.mode === 'hide-feed'))
  )
}

function budgetTightens(previous: Rule, next: Rule): boolean {
  const before = previous.dailyBudgetMinutes
  const after = next.dailyBudgetMinutes
  if (before === after) return true
  return after !== undefined && (before === undefined || after < before)
}

function isPlainAllow(rule: Rule): boolean {
  return rule.mode === 'allow' && rule.dailyBudgetMinutes === undefined
}

function judgeModified(
  previous: Rule,
  next: Rule,
  workHours: WorkHoursPair,
  catalog: RulesCatalog
): RuleVerdict {
  let tightens = sameTarget(previous.target, next.target, catalog)
  let activates = false
  if (previous.enabled !== next.enabled) {
    if (next.enabled) {
      tightens &&= next.mode !== 'allow'
      activates = true
    } else {
      tightens &&= isPlainAllow(previous)
    }
  }
  tightens &&= modeTightens(previous, next) && budgetTightens(previous, next)
  if (!jsonEqual(previous.schedules, next.schedules)) {
    const before = weekSetOf(resolveSchedules(previous.schedules, workHours.previous))
    const after = weekSetOf(resolveSchedules(next.schedules, workHours.next))
    tightens &&= next.mode !== 'allow' && weekSetContains(after, before)
    activates ||= !weekSetsEqual(after, before)
  }
  return { tightens, activates: activates && next.enabled }
}

export function judgeRuleChange(
  previous: Rule | undefined,
  next: Rule | undefined,
  workHours: WorkHoursPair,
  catalog: RulesCatalog
): RuleVerdict {
  if (previous === undefined) {
    const added = next as Rule
    return { tightens: added.enabled && added.mode !== 'allow', activates: added.enabled }
  }
  if (next === undefined)
    return { tightens: previous.enabled && isPlainAllow(previous), activates: false }
  return judgeModified(previous, next, workHours, catalog)
}
