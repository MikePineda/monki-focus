// SPDX-License-Identifier: AGPL-3.0-or-later
import { bedtimePhase, instantOf, isScheduleActive, localTimeAt } from '@monki-focus/engine'
import type { Ruleset } from '@monki-focus/rules/pure'
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
 * What the rule set has in force at `nowMs`, per pinned zone: the local
 * date (budgets reset at midnight), the bedtime phase and the ids of the
 * enabled rules whose schedules are active, in code-unit order.
 */
export function activeRulesSnapshot(ruleset: Ruleset, nowMs: number): string {
  const now = instantOf(nowMs)
  return zonesOf(ruleset)
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
}

/**
 * The coarse backstop behind the decisions' `validUntil` (the
 * `ValidityAlarm` and the pages' own timers): every minute the worker
 * compares which rules are in force (schedules, bedtime, budget day) with
 * the last snapshot, and when a schedule edge changed them `onChange` tells
 * the open site tabs to ask again. No decision is probed here. The snapshot
 * lives in `storage.session`, so a worker that slept in between still sees
 * the change.
 */
export class RestrictionWatcher {
  constructor(private readonly options: RestrictionWatcherOptions) {}

  /** Returns whether the active rules changed (and `onChange` ran). */
  async check(): Promise<boolean> {
    const { rulesets, clock, storage, onChange } = this.options
    const snapshot = activeRulesSnapshot(await rulesets.load(), clock.now())
    const previous = (await storage.get(RESTRICTION_SNAPSHOT_NAME))[RESTRICTION_SNAPSHOT_NAME]
    if (previous === snapshot) return false
    await storage.set({ [RESTRICTION_SNAPSHOT_NAME]: snapshot })
    if (typeof previous !== 'string') return false
    await onChange()
    return true
  }
}
