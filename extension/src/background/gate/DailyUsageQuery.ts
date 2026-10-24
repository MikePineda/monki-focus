// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ActivityEvent } from '@monki-focus/analytics'
import {
  epochSecondsOf,
  instantOf,
  isScheduleActive,
  localTimeAt,
  matchesTarget,
  nextLocalMidnight,
  normalizeUrl,
  utcInstantOf,
  type RulesCatalog,
} from '@monki-focus/engine'
import type { DailyUsage, Rule, Ruleset } from '@monki-focus/rules/pure'
import type { GateDiagnosticCode } from './GateDiagnostics'

/** A heartbeat run can start well before midnight and spill into today. */
const SPILL_SECONDS = 12 * 3_600
/** A local day lasts at most 25 hours. */
const MAX_DAY_SECONDS = 25 * 3_600
/** Decisions run on every page and every minute; usage moves slowly. */
const CACHE_MS = 10_000

/** The tracked web events (E7's `events` store) between two instants. */
export type TrackedEvents = (from: string, to: string) => Promise<ActivityEvent[]>

export interface DailyUsageQueryOptions {
  events: TrackedEvents
  catalog: RulesCatalog
  rulesets: { load(): Promise<Ruleset> }
  diagnose?: (code: GateDiagnosticCode) => void
}

interface TodayWindow {
  zone: string
  start: number
  end: number
}

function isWebEvent(
  event: ActivityEvent
): event is ActivityEvent & { data: { domain: string; path: string } } {
  return typeof (event.data as { domain?: unknown }).domain === 'string'
}

/** The pinned zone and, while a zone change waits, the pending one (§6.3). */
function zonesOf(ruleset: Ruleset): string[] {
  const pending = ruleset.pendingTimeZone
  return pending === undefined || pending === ruleset.timeZone
    ? [ruleset.timeZone]
    : [ruleset.timeZone, pending]
}

/** `[local midnight, next local midnight)` around `nowSeconds` in `zone`. */
function todayIn(zone: string, nowSeconds: number): TodayWindow {
  const end = nextLocalMidnight(nowSeconds, zone)
  let start = nextLocalMidnight(nowSeconds - MAX_DAY_SECONDS, zone)
  while (start <= nowSeconds) {
    const next = nextLocalMidnight(start, zone)
    if (next > nowSeconds) break
    start = next
  }
  return { zone, start, end }
}

/**
 * Today's active seconds per budgeted rule (`DecisionState.usage`,
 * SEMANTICS.md §5.2.2), from the time E7 tracked. Each web event accrues to
 * **every** enabled rule with a `dailyBudgetMinutes` whose target matches
 * the event's page (the engine's `normalizeUrl` + `matchesTarget`) and whose
 * schedules were active, counting only the part of the event inside today
 * (events are split at local midnight). While a time-zone change waits,
 * today is measured in both zones and the larger count wins, so the move
 * never grants extra time. Incognito time is tracked by domain only (path
 * `/`, no surface), so it accrues to site budgets but not to path or
 * surface budgets.
 *
 * When the events cannot be read, the last good value of the same day is
 * kept (the database open is retried next time); without one usage is
 * unknown and the decision goes ahead without a budget block, with a
 * diagnostic.
 */
export class DailyUsageQuery {
  private cached: { at: number; ruleset: Ruleset; usage: Promise<DailyUsage | null> } | null = null
  private lastGood: DailyUsage | null = null

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
    const localDate = localTimeAt(nowSeconds, ruleset.timeZone).localDate
    const windows = zonesOf(ruleset).map((zone) => todayIn(zone, nowSeconds))
    const from = Math.min(...windows.map((window) => window.start)) - SPILL_SECONDS

    let tracked: ActivityEvent[]
    try {
      tracked = await events(utcInstantOf(from), utcInstantOf(nowSeconds + 1))
    } catch {
      if (this.lastGood?.localDate === localDate) {
        this.options.diagnose?.('usage.lastGoodKept')
        return this.lastGood
      }
      this.options.diagnose?.('usage.unavailable')
      return null
    }

    // Rule ids are data (§14): Maps, never an object's prototype.
    const byZone = windows.map(() => new Map<string, number>())
    for (const event of tracked) {
      if (!isWebEvent(event)) continue
      const normalised = normalizeUrl(`https://${event.data.domain}${event.data.path}`, catalog)
      if ('rejected' in normalised) continue
      const observation = { kind: 'site' as const, ...normalised }
      const matching = budgeted.filter((rule) => matchesTarget(rule.target, observation, catalog))
      if (matching.length === 0) continue
      const begin = epochSecondsOf(event.timestamp)
      windows.forEach((window, index) => {
        const overlapStart = Math.max(begin, window.start)
        const seconds = Math.min(begin + event.duration, window.end) - overlapStart
        if (seconds <= 0) return
        for (const rule of matching) {
          if (!this.scheduled(rule, ruleset, overlapStart, window.zone)) continue
          const counts = byZone[index] as Map<string, number>
          counts.set(rule.id, (counts.get(rule.id) ?? 0) + seconds)
        }
      })
    }
    const secondsByRule = new Map<string, number>()
    for (const counts of byZone) {
      for (const [ruleId, seconds] of counts) {
        secondsByRule.set(ruleId, Math.max(secondsByRule.get(ruleId) ?? 0, seconds))
      }
    }
    const usage = { localDate, secondsByRule: Object.fromEntries(secondsByRule) }
    this.lastGood = usage
    return usage
  }

  private scheduled(rule: Rule, ruleset: Ruleset, atSeconds: number, zone: string): boolean {
    return isScheduleActive(rule.schedules, ruleset.workHours, utcInstantOf(atSeconds), zone)
  }
}
