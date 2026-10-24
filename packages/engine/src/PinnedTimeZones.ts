// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The pinned time zone (SEMANTICS.md §6.3). `ruleset.timeZone` is the only
 * zone; while a change of zone waits the set also carries `pendingTimeZone`
 * and every schedule is evaluated in both with the stricter outcome winning:
 * a restrictive rule is active when it is active in either zone, an `allow`
 * rule only when it is active in both. The device zone is never an input.
 */
import type { Rule, Ruleset, TimeZone } from '@monki-focus/rules'
import { isScheduleActiveAt } from './ScheduleEvaluator.ts'
import { localTimeAt } from './ZonedTime.ts'

export function zonesOf(ruleset: Pick<Ruleset, 'timeZone' | 'pendingTimeZone'>): TimeZone[] {
  const pending = ruleset.pendingTimeZone
  return pending === undefined || pending === ruleset.timeZone
    ? [ruleset.timeZone]
    : [ruleset.timeZone, pending]
}

/** Whether the rule's schedules make it active at the instant, in the pinned zone(s). */
export function isRuleScheduledAt(rule: Rule, ruleset: Ruleset, epochSeconds: number): boolean {
  const activeIn = (zone: TimeZone): boolean =>
    isScheduleActiveAt(rule.schedules, ruleset.workHours, epochSeconds, zone)
  const zones = zonesOf(ruleset)
  return rule.mode === 'allow' ? zones.every(activeIn) : zones.some(activeIn)
}

/** Today's local date in each pinned zone (budget days, §5.2.2). */
export function localDatesAt(ruleset: Ruleset, epochSeconds: number): string[] {
  return zonesOf(ruleset).map((zone) => localTimeAt(epochSeconds, zone).localDate)
}
