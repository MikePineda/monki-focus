// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ActivityEvent } from '@monki-focus/analytics'
import {
  epochSecondsOf,
  instantOf,
  isScheduleActive,
  localTimeAt,
  matchesTarget,
  normalizeUrl,
  utcInstantOf,
  type RulesCatalog,
} from '@monki-focus/engine'
import type { DailyUsage, Ruleset } from '@monki-focus/rules/pure'

/** A local day lasts at most 25 hours; read a little more and filter by date. */
const LOOKBACK_SECONDS = 27 * 3_600
/** Decisions run on every page and every minute; usage moves slowly. */
const CACHE_MS = 10_000

/** The tracked web events (E7's `events` store) between two instants. */
export type TrackedEvents = (from: string, to: string) => Promise<ActivityEvent[]>

export interface DailyUsageQueryOptions {
  events: TrackedEvents
  catalog: RulesCatalog
  rulesets: { load(): Promise<Ruleset> }
}

function isWebEvent(
  event: ActivityEvent
): event is ActivityEvent & { data: { domain: string; path: string } } {
  return typeof (event.data as { domain?: unknown }).domain === 'string'
}

/**
 * Today's active seconds per budgeted rule (`DecisionState.usage`,
 * SEMANTICS.md §5.2.2), from the time E7 tracked: every web event of the
 * local day (pinned zone) accrues to **every** enabled rule with a
 * `dailyBudgetMinutes` whose target matches the event's page (the engine's
 * `matchesTarget` on the engine's `normalizeUrl`) and whose schedules were
 * active then. The answer is cached for a few seconds.
 */
export class DailyUsageQuery {
  private cached: { at: number; ruleset: Ruleset; usage: Promise<DailyUsage | null> } | null = null

  constructor(private readonly options: DailyUsageQueryOptions) {}

  /** A changed rule set (new budgets) is never answered from the cache. */
  async usageAt(nowMs: number): Promise<DailyUsage | null> {
    const ruleset = await this.options.rulesets.load()
    const cached = this.cached
    if (cached && cached.ruleset === ruleset && Math.abs(nowMs - cached.at) < CACHE_MS) {
      return cached.usage
    }
    const usage = this.compute(ruleset, nowMs)
    this.cached = { at: nowMs, ruleset, usage }
    usage.catch(() => {
      this.cached = null
    })
    return usage
  }

  private async compute(ruleset: Ruleset, nowMs: number): Promise<DailyUsage | null> {
    const { events, catalog } = this.options
    const budgeted = ruleset.rules.filter(
      (rule) => rule.enabled && rule.dailyBudgetMinutes !== undefined
    )
    if (budgeted.length === 0) return null
    const nowSeconds = epochSecondsOf(instantOf(nowMs))
    const zone = ruleset.timeZone
    const localDate = localTimeAt(nowSeconds, zone).localDate
    // Rule ids are data (§14): a Map, never an object's prototype.
    const secondsByRule = new Map<string, number>()
    const today = await events(
      utcInstantOf(nowSeconds - LOOKBACK_SECONDS),
      utcInstantOf(nowSeconds + 1)
    )
    for (const event of today) {
      if (!isWebEvent(event)) continue
      const at = epochSecondsOf(event.timestamp)
      if (localTimeAt(at, zone).localDate !== localDate) continue
      const normalised = normalizeUrl(`https://${event.data.domain}${event.data.path}`, catalog)
      if ('rejected' in normalised) continue
      const observation = { kind: 'site' as const, ...normalised }
      for (const rule of budgeted) {
        if (!matchesTarget(rule.target, observation, catalog)) continue
        if (!isScheduleActive(rule.schedules, ruleset.workHours, utcInstantOf(at), zone)) continue
        secondsByRule.set(rule.id, (secondsByRule.get(rule.id) ?? 0) + event.duration)
      }
    }
    return { localDate, secondsByRule: Object.fromEntries(secondsByRule) }
  }
}
