// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * `effectiveRuleSet(old, new, now, pendingEffectiveFrom, catalog) →
 * {effectiveToday, effectiveFrom}` (SEMANTICS.md §8). `old` is the currently
 * effective set. A change that only tightens applies at once; anything else
 * waits for the next local midnight (or the end of an old window running
 * then) and never earlier than a pending change. Each part (rule by id,
 * bedtime, work hours, time zone, category by target) is judged on its own.
 */
import type { Instant, Rule, Ruleset, UtcInstant } from '@monki-focus/rules'
import { bedtimeChangeWaits } from './BedtimeTightening.ts'
import { planCategories } from './CategoryTightening.ts'
import type { DailyWindowSpec } from './DailyWindow.ts'
import { effectiveFromOf } from './EffectiveFromCalculator.ts'
import { epochSecondsOf, utcInstantOf } from './Instant.ts'
import { jsonEqual } from './JsonEquality.ts'
import { passesOutrankCheck } from './OutrankCheck.ts'
import { judgeRuleChange } from './RuleTightening.ts'
import type { RuleVerdict } from './RuleTightening.ts'
import type { RulesCatalog } from './RulesCatalog.ts'
import { resolveSchedules } from './ScheduleEvaluator.ts'

export interface EffectiveRuleSet {
  effectiveToday: Ruleset
  /** When `new` takes full effect; null when it already applies entirely. */
  effectiveFrom: UtcInstant | null
}

interface RulePart {
  id: string
  previous: Rule | undefined
  next: Rule | undefined
  verdict: RuleVerdict
}

/** The rule of a part as it applies today: `new` when the part applies, else `old`. */
function ruleToday(part: RulePart, applies: boolean): Rule | undefined {
  return applies ? part.next : part.previous
}

/**
 * Parts that tighten by the field rules, then the outrank check against what
 * would actually apply now, iterated to a fixed point (§8).
 */
function applicableRuleIds(
  parts: readonly RulePart[],
  workHoursToday: Ruleset['workHours'],
  catalog: RulesCatalog
): Set<string> {
  const applicable = new Set(parts.filter((part) => part.verdict.tightens).map((part) => part.id))
  for (;;) {
    const today = parts.flatMap((part) => ruleToday(part, applicable.has(part.id)) ?? [])
    const failing = parts.filter(
      (part) =>
        applicable.has(part.id) &&
        part.verdict.activates &&
        part.next !== undefined &&
        !passesOutrankCheck(part.next, today, workHoursToday, catalog)
    )
    if (failing.length === 0) return applicable
    for (const part of failing) applicable.delete(part.id)
  }
}

/**
 * `{ref: "workHours"}` resolves to `old.workHours` in the old rule and to the
 * work hours that apply today in the new one (§8).
 */
function ruleParts(
  old: Ruleset,
  next: Ruleset,
  workHoursToday: Ruleset['workHours'],
  catalog: RulesCatalog
): RulePart[] {
  const previousById = new Map(old.rules.map((rule) => [rule.id, rule]))
  const nextById = new Map(next.rules.map((rule) => [rule.id, rule]))
  const ids = [...new Set([...previousById.keys(), ...nextById.keys()])].sort()
  const workHours = { previous: old.workHours, next: workHoursToday }
  return ids.map((id) => {
    const previous = previousById.get(id)
    const rule = nextById.get(id)
    const unchanged = previous !== undefined && rule !== undefined && jsonEqual(previous, rule)
    const verdict = unchanged
      ? { tightens: true, activates: false }
      : judgeRuleChange(previous, rule, workHours, catalog)
    return { id, previous, next: rule, verdict }
  })
}

/**
 * Whether the old schedule windows of a waiting rule must run to their end
 * (§8 step 2): its `schedules` changed, or it is an enabled non-allow rule
 * that is removed or disabled (deleting a block during its window waits).
 */
function windowRunsOut({ previous, next }: RulePart): boolean {
  if (previous === undefined) return false
  if (next !== undefined && !jsonEqual(previous.schedules, next.schedules)) return true
  const stopsApplying = next === undefined || !next.enabled
  return stopsApplying && previous.enabled && previous.mode !== 'allow'
}

export function effectiveRuleSet(
  old: Ruleset,
  next: Ruleset,
  now: Instant,
  pendingEffectiveFrom: UtcInstant | null,
  catalog: RulesCatalog
): EffectiveRuleSet {
  const timeZoneWaits = old.timeZone !== next.timeZone
  const workHoursWait = !jsonEqual(old.workHours, next.workHours)
  const bedtimeWaits = bedtimeChangeWaits(old.bedtime, next.bedtime)
  const categories = planCategories(old.categories, next.categories, catalog)
  const workHoursToday = workHoursWait ? old.workHours : next.workHours
  const parts = ruleParts(old, next, workHoursToday, catalog)
  const applicable = applicableRuleIds(parts, workHoursToday, catalog)
  const waitingRules = parts.filter((part) => !applicable.has(part.id))

  const somethingWaits =
    timeZoneWaits || workHoursWait || bedtimeWaits || categories.waits || waitingRules.length > 0
  if (!somethingWaits) return { effectiveToday: next, effectiveFrom: null }

  // A waiting zone change keeps the old zone and evaluates the new one alongside it (§6.3).
  const zone: Pick<Ruleset, 'timeZone' | 'pendingTimeZone'> = timeZoneWaits
    ? { timeZone: old.timeZone, pendingTimeZone: next.timeZone }
    : next.pendingTimeZone === undefined
      ? { timeZone: next.timeZone }
      : { timeZone: next.timeZone, pendingTimeZone: next.pendingTimeZone }
  const effectiveToday: Ruleset = {
    schemaVersion: next.schemaVersion,
    revision: next.revision,
    updatedAt: next.updatedAt,
    ...zone,
    // Parts are in id order, so the rules are sorted by id (§8).
    rules: parts.flatMap((part) => ruleToday(part, applicable.has(part.id)) ?? []),
    categories: categories.categoriesToday,
    bedtime: bedtimeWaits ? old.bedtime : next.bedtime,
    workHours: workHoursToday,
  }

  // §8 step 2: old windows of the waiting parts that must run to their end.
  const windows: DailyWindowSpec[] = []
  if ((bedtimeWaits || categories.waits || timeZoneWaits) && old.bedtime.enabled) {
    windows.push(old.bedtime)
  }
  if (workHoursWait) windows.push(old.workHours)
  const windowedOldRules = timeZoneWaits
    ? old.rules.filter((rule) => rule.enabled)
    : waitingRules.flatMap((part) => (windowRunsOut(part) ? [part.previous as Rule] : []))
  for (const rule of windowedOldRules) {
    windows.push(...resolveSchedules(rule.schedules, old.workHours))
  }

  const zones = timeZoneWaits ? [old.timeZone, next.timeZone] : [old.timeZone]
  const pending = pendingEffectiveFrom === null ? null : epochSecondsOf(pendingEffectiveFrom)
  const effectiveFrom = effectiveFromOf(epochSecondsOf(now), zones, windows, pending)
  return { effectiveToday, effectiveFrom: utcInstantOf(effectiveFrom) }
}
