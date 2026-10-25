// SPDX-License-Identifier: AGPL-3.0-or-later
import { bedtimePhase, instantOf, isScheduleActive, localTimeAt } from '@monki-focus/engine'
import type { DailyUsage, Ruleset } from '@monki-focus/rules/pure'
import type { Clock } from '../../shared/clock'

/** The coarse backstop alarm (the decisions' own `validUntil` alarm is `ValidityAlarm`). */
export const RESTRICTION_ALARM = 'decision.refresh'
/** Chrome's minimum alarm period; schedules are minute-grained. */
export const RESTRICTION_CHECK_MINUTES = 1
/** `storage.session` key of the last snapshot of active rules (survives worker restarts). */
export const RESTRICTION_SNAPSHOT_NAME = 'decision.activeRules'

/** The slice of a storage area the watcher keeps its snapshot in. */
export interface SnapshotStorage {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

export interface RestrictionWatcherOptions {
  rulesets: { load(): Promise<Ruleset> }
  clock: Clock
  /** Today's usage per budgeted rule (`DecisionState.usage`); null when unknown. */
  usage?: () => Promise<DailyUsage | null>
  storage: SnapshotStorage
  /** Runs when the active rules changed since the last check. */
  onChange: () => Promise<void> | void
}

/** The pinned zone and, while a zone change waits, the pending one (SEMANTICS.md §6.3). */
function zonesOf(ruleset: Ruleset): string[] {
  const pending = ruleset.pendingTimeZone
  return pending === undefined || pending === ruleset.timeZone
    ? [ruleset.timeZone]
    : [ruleset.timeZone, pending]
}

/**
 * The enabled budgeted rules whose usage has reached the budget, counted
 * only when `usage.localDate` is today in a pinned zone (SEMANTICS.md
 * §5.2.2, §6.3), in code-unit order. Usage grows without changing
 * `validUntil`, so this is how a budget running out reaches open pages.
 */
export function exhaustedBudgets(
  ruleset: Ruleset,
  usage: DailyUsage | null,
  nowMs: number
): string[] {
  if (usage === null) return []
  const seconds = Math.floor(nowMs / 1000)
  const today = zonesOf(ruleset).map((zone) => localTimeAt(seconds, zone).localDate)
  if (!today.includes(usage.localDate)) return []
  return ruleset.rules
    .filter(
      (rule) =>
        rule.enabled &&
        rule.dailyBudgetMinutes !== undefined &&
        Object.hasOwn(usage.secondsByRule, rule.id) &&
        (usage.secondsByRule[rule.id] ?? 0) >= rule.dailyBudgetMinutes * 60
    )
    .map((rule) => rule.id)
    .sort()
}

/**
 * What the rule set has in force at `nowMs`, per pinned zone: the local
 * date (budgets reset at midnight), the bedtime phase and the ids of the
 * enabled rules whose schedules are active, in code-unit order; then the
 * budgets already spent today.
 */
export function activeRulesSnapshot(
  ruleset: Ruleset,
  nowMs: number,
  usage: DailyUsage | null = null
): string {
  const now = instantOf(nowMs)
  const zones = zonesOf(ruleset)
    .map((zone) => {
      const date = localTimeAt(Math.floor(nowMs / 1000), zone).localDate
      const bedtime = bedtimePhase(ruleset.bedtime, now, zone)
      const active = ruleset.rules
        .filter((rule) => rule.enabled)
        .filter((rule) => isScheduleActive(rule.schedules, ruleset.workHours, now, zone))
        .map((rule) => rule.id)
        .sort()
      return [zone, date, bedtime, ...active].join(' ')
    })
    .join('\n')
  return `${zones}\nexhausted ${exhaustedBudgets(ruleset, usage, nowMs).join(' ')}`
}

/**
 * The coarse backstop behind the decisions' `validUntil` (the
 * `ValidityAlarm` and the pages' own timers): every minute the worker
 * compares which rules are in force (schedules, bedtime, budget day) and
 * which budgets are spent with the last snapshot, and when a schedule edge
 * or a budget running out changed them `onChange` tells the open site tabs
 * to ask again (§5.6: usage that keeps accruing is not in `validUntil`). No decision is probed here. The snapshot
 * lives in `storage.session`, so a worker that slept in between still sees
 * the change.
 */
export class RestrictionWatcher {
  constructor(private readonly options: RestrictionWatcherOptions) {}

  /** Returns whether the active rules changed (and `onChange` ran). */
  async check(): Promise<boolean> {
    const { rulesets, clock, storage, onChange } = this.options
    // Usage only adds spent budgets; when it cannot be read, compare without it.
    const usage = (await this.options.usage?.().catch(() => null)) ?? null
    const snapshot = activeRulesSnapshot(await rulesets.load(), clock.now(), usage)
    const previous = (await storage.get(RESTRICTION_SNAPSHOT_NAME))[RESTRICTION_SNAPSHOT_NAME]
    if (previous === snapshot) return false
    await storage.set({ [RESTRICTION_SNAPSHOT_NAME]: snapshot })
    if (typeof previous !== 'string') return false
    await onChange()
    return true
  }
}
