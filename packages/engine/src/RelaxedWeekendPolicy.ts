// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Relaxed weekends (SEMANTICS.md §6.4), an optional softer weekend the user
 * chooses (`ruleset.relaxedWeekends`, absent = off). The day sets are fixed:
 *
 * - **relaxed nights**: bedtime windows that start on a Friday or Saturday
 *   (also after midnight). Bedtime then gates with an intention instead of
 *   blocking; with a waiting zone change every zone in which bedtime is
 *   active must be in such a night (the stricter zone keeps the block);
 * - **relaxed days**: Saturdays and Sundays, in every pinned zone. A `block`
 *   or `hide-feed` rule on a short-video surface then counts as `friction`.
 */
import type { Rule, Ruleset } from '@monki-focus/rules'
import { occurrenceAt } from './DailyWindow.ts'
import { zonesOf } from './PinnedTimeZones.ts'
import type { RulesCatalog } from './RulesCatalog.ts'
import { localTimeAt, weekdayOfDay } from './ZonedTime.ts'

/** Monday = 0 … Sunday = 6. */
const FRIDAY = 4
const SATURDAY = 5
const SUNDAY = 6

function isRelaxing(ruleset: Ruleset): boolean {
  return ruleset.relaxedWeekends?.enabled === true
}

/** Whether bedtime is active at the instant and every active zone is in a Friday or Saturday night. */
export function isRelaxedNightAt(ruleset: Ruleset, epochSeconds: number): boolean {
  if (!isRelaxing(ruleset) || !ruleset.bedtime.enabled) return false
  const startDays = zonesOf(ruleset).flatMap((zone) => {
    const occurrence = occurrenceAt(ruleset.bedtime, localTimeAt(epochSeconds, zone))
    return occurrence === null ? [] : [weekdayOfDay(occurrence.startDayNumber)]
  })
  return startDays.length > 0 && startDays.every((day) => day === FRIDAY || day === SATURDAY)
}

/** Whether the instant is on a Saturday or Sunday in every pinned zone. */
export function isRelaxedDayAt(ruleset: Ruleset, epochSeconds: number): boolean {
  if (!isRelaxing(ruleset)) return false
  return zonesOf(ruleset).every((zone) => {
    const { weekday } = localTimeAt(epochSeconds, zone)
    return weekday === SATURDAY || weekday === SUNDAY
  })
}

function relaxes(rule: Rule, catalog: RulesCatalog): boolean {
  return (
    (rule.mode === 'block' || rule.mode === 'hide-feed') &&
    rule.target.kind === 'surface' &&
    catalog.isShortVideo(rule.target.surface)
  )
}

/** The rules as they take part at the instant: short-video limits become friction on a relaxed day. */
export function relaxedRulesAt(
  rules: readonly Rule[],
  ruleset: Ruleset,
  epochSeconds: number,
  catalog: RulesCatalog
): Rule[] {
  if (!isRelaxedDayAt(ruleset, epochSeconds)) return [...rules]
  return rules.map((rule) => (relaxes(rule, catalog) ? { ...rule, mode: 'friction' } : rule))
}
