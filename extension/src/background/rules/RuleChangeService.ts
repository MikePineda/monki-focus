// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  effectiveRuleSet,
  epochSecondsOf,
  instantOf,
  nextLocalMidnight,
  utcInstantOf,
  type RulesCatalog,
} from '@monki-focus/engine'
import type { RejectionCode, Ruleset, UtcInstant, ValidationResult } from '@monki-focus/rules/pure'
import type { Clock } from '../../shared/clock'
import {
  configuredRuleset,
  type PendingRuleChange,
  type RuleChangeOutcome,
  type RuleChangeRejection,
  type RuleChangeProposal,
  type RulesState,
} from '../../shared/RuleChangeContract'
import { validateRuleset } from '../../shared/RulesetValidation'
import type { PendingRuleChangeStore } from './PendingRuleChangeStore'
import type { RulesetStore } from './RulesetStore'

export interface RuleChangeServiceOptions {
  /** The single writer of the effective rule set (`save` holds its lock). */
  rulesets: Pick<RulesetStore, 'load' | 'save'>
  pending: Pick<PendingRuleChangeStore, 'load' | 'save' | 'clear'>
  catalog: RulesCatalog
  clock: Clock
  validate?: (value: unknown) => ValidationResult
  /** Called with the new `effectiveFrom` (or null) so the worker can set its alarm. */
  onPendingChanged?: (effectiveFrom: UtcInstant | null) => void | Promise<void>
}

/** Alarm that applies a pending rule change at its `effectiveFrom`. */
export const PENDING_RULES_ALARM = 'rules.pending'

/** The slice of `browser.alarms` the pending-change alarm uses. */
export interface PendingAlarmApi {
  create(name: string, info: { when: number }): Promise<void> | void
  clear(name: string): Promise<boolean> | boolean | void
}

/** `onPendingChanged` that keeps one alarm at the pending change's `effectiveFrom`. */
export function pendingRulesAlarm(
  alarms: PendingAlarmApi
): (effectiveFrom: UtcInstant | null) => Promise<void> {
  return async (effectiveFrom) => {
    if (effectiveFrom === null) await alarms.clear(PENDING_RULES_ALARM)
    else await alarms.create(PENDING_RULES_ALARM, { when: Date.parse(effectiveFrom) })
  }
}

const DAY_SECONDS = 86_400
const MAX_RULES = 500

function todayRejection(today: Ruleset, code: RejectionCode): RuleChangeRejection {
  if (today.rules.length > MAX_RULES) return 'too_many_rules'
  return code === 'too_large' ? 'too_large' : 'invalid_ruleset'
}

function revisionOf(ruleset: Ruleset): number {
  return Number.isInteger(ruleset.revision) ? ruleset.revision : 0
}

/**
 * Every rule set edit goes through here and through the engine's rule-change
 * policy (`effectiveRuleSet`, SEMANTICS.md §8): what only tightens is saved
 * to the effective rule set at once; when anything loosens, the effective
 * set gets only the immediately applicable parts and the whole proposal
 * waits in `rules.pending` until `effectiveFrom`. Operations run one at a
 * time, so a read-judge-write sequence never interleaves with another.
 */
export class RuleChangeService {
  private queue: Promise<unknown> = Promise.resolve()
  private readonly validate: (value: unknown) => ValidationResult

  constructor(private readonly options: RuleChangeServiceOptions) {
    this.validate = options.validate ?? validateRuleset
  }

  /** The effective and the pending set (a due pending change is applied first). */
  state(): Promise<RulesState> {
    return this.exclusive(async () => {
      await this.promoteWhenDue()
      return this.read()
    })
  }

  propose(proposal: RuleChangeProposal): Promise<RuleChangeOutcome> {
    return this.exclusive(async () => {
      await this.promoteWhenDue()
      const current = await this.read()
      const configured = configuredRuleset(current)
      if (proposal.baseRevision !== revisionOf(configured)) {
        return { status: 'rejected', code: 'stale_revision' }
      }
      // Only one zone can wait: a third one would drop the waiting zone at once.
      const waitingZone = current.effective.pendingTimeZone
      const zone = proposal.ruleset.timeZone
      if (
        waitingZone !== undefined &&
        zone !== current.effective.timeZone &&
        zone !== waitingZone
      ) {
        return { status: 'rejected', code: 'zone_change_pending' }
      }
      const nowMs = this.options.clock.now()
      const now = instantOf(nowMs)
      // `pendingTimeZone` belongs to the engine, never to an edit.
      const next: Ruleset = {
        ...proposal.ruleset,
        revision: revisionOf(configured) + 1,
        updatedAt: utcInstantOf(epochSecondsOf(now)),
      }
      delete next.pendingTimeZone
      const verdict = this.validate(next)
      if (!verdict.valid) return { status: 'rejected', code: verdict.code }

      if (!this.validate(current.effective).valid) {
        // The stored set cannot be compared with: it stays (fail closed in
        // the engine) and the proposal waits in full.
        const effectiveFrom = this.fallbackEffectiveFrom(current, next, now)
        const pending: PendingRuleChange = { ruleset: next, effectiveFrom }
        await this.options.pending.save(pending)
        await this.options.onPendingChanged?.(effectiveFrom)
        return {
          status: 'pending',
          effectiveFrom,
          state: { effective: current.effective, pending },
        }
      }

      const { effectiveToday, effectiveFrom } = this.keepWaitingZone(
        current,
        now,
        effectiveRuleSet(
          current.effective,
          next,
          now,
          current.pending?.effectiveFrom ?? null,
          this.options.catalog
        )
      )
      // What applies today must itself be a valid set, or it would be stored
      // and later read as unreadable: refuse the change, save nothing.
      const today = this.validate(effectiveToday)
      if (!today.valid) {
        return { status: 'rejected', code: todayRejection(effectiveToday, today.code) }
      }
      await this.options.rulesets.save(effectiveToday)
      if (effectiveFrom === null) {
        await this.options.pending.clear()
        await this.options.onPendingChanged?.(null)
        return { status: 'applied', state: { effective: effectiveToday, pending: null } }
      }
      const pending: PendingRuleChange = { ruleset: next, effectiveFrom }
      await this.options.pending.save(pending)
      await this.options.onPendingChanged?.(effectiveFrom)
      return { status: 'pending', effectiveFrom, state: { effective: effectiveToday, pending } }
    })
  }

  /**
   * Drops the pending change: what applies now stays, nothing gets looser.
   * The effective set gets the next revision, so pages that edited the
   * cancelled set are refused (`stale_revision`). A waiting time-zone change
   * leaves `pendingTimeZone` in force (both zones apply); removing it is a
   * loosening, so it stays pending until the cancelled `effectiveFrom`.
   */
  cancelPending(): Promise<RulesState> {
    return this.exclusive(async () => {
      const current = await this.read()
      if (current.pending === null) return current
      const effective: Ruleset = {
        ...current.effective,
        revision: revisionOf(configuredRuleset(current)) + 1,
        updatedAt: utcInstantOf(epochSecondsOf(instantOf(this.options.clock.now()))),
      }
      await this.options.rulesets.save(effective)
      if (effective.pendingTimeZone === undefined) {
        await this.options.pending.clear()
        await this.options.onPendingChanged?.(null)
        return { effective, pending: null }
      }
      const ruleset: Ruleset = { ...effective }
      delete ruleset.pendingTimeZone
      const pending: PendingRuleChange = {
        ruleset,
        effectiveFrom: current.pending.effectiveFrom,
      }
      await this.options.pending.save(pending)
      await this.options.onPendingChanged?.(pending.effectiveFrom)
      return { effective, pending }
    })
  }

  /** Applies the pending change in full once `effectiveFrom` has passed. */
  promoteIfDue(): Promise<boolean> {
    return this.exclusive(() => this.promoteWhenDue())
  }

  /**
   * While a time-zone change waits, the stored set carries `pendingTimeZone`
   * (both zones apply, the stricter wins). A proposal in the stored zone
   * (after a cancel, or reverting the zone) would let the engine drop the
   * second zone at once: that is a loosening, so the second zone stays in
   * what applies today and its removal waits, never earlier than the
   * pending change it replaces.
   */
  private keepWaitingZone(
    current: RulesState,
    now: string,
    judged: { effectiveToday: Ruleset; effectiveFrom: UtcInstant | null }
  ): { effectiveToday: Ruleset; effectiveFrom: UtcInstant | null } {
    const waitingZone = current.effective.pendingTimeZone
    const { effectiveToday } = judged
    if (
      waitingZone === undefined ||
      effectiveToday.pendingTimeZone !== undefined ||
      effectiveToday.timeZone !== current.effective.timeZone
    ) {
      return judged
    }
    const candidates: number[] = []
    if (judged.effectiveFrom !== null) candidates.push(epochSecondsOf(judged.effectiveFrom))
    if (current.pending) candidates.push(epochSecondsOf(current.pending.effectiveFrom))
    if (candidates.length === 0) {
      // No record of when the zone change ends: wait for both zones' midnight.
      const nowSeconds = epochSecondsOf(now)
      for (const zone of [effectiveToday.timeZone, waitingZone]) {
        try {
          candidates.push(nextLocalMidnight(nowSeconds, zone))
        } catch {
          candidates.push(nowSeconds + DAY_SECONDS)
        }
      }
    }
    return {
      effectiveToday: { ...effectiveToday, pendingTimeZone: waitingZone },
      effectiveFrom: utcInstantOf(Math.max(...candidates)),
    }
  }

  /**
   * `effectiveFrom` when the stored set cannot be judged: the latest next
   * local midnight of every zone involved (the stored set's zones, never only
   * the proposal's), a full day when a zone does not resolve, and never
   * earlier than a pending change.
   */
  private fallbackEffectiveFrom(current: RulesState, next: Ruleset, now: string): UtcInstant {
    const nowSeconds = epochSecondsOf(now)
    const stored = current.effective as Partial<Ruleset>
    const zones: unknown[] = [stored.timeZone, next.timeZone]
    if (stored.pendingTimeZone !== undefined) zones.push(stored.pendingTimeZone)
    const candidates: number[] = []
    for (const zone of zones) {
      try {
        if (typeof zone !== 'string') throw new RangeError('no zone')
        candidates.push(nextLocalMidnight(nowSeconds, zone))
      } catch {
        candidates.push(nowSeconds + DAY_SECONDS)
      }
    }
    if (current.pending) candidates.push(epochSecondsOf(current.pending.effectiveFrom))
    return utcInstantOf(Math.max(...candidates))
  }

  private async promoteWhenDue(): Promise<boolean> {
    const pending = await this.options.pending.load()
    if (pending === null) return false
    const nowSeconds = epochSecondsOf(instantOf(this.options.clock.now()))
    if (nowSeconds < epochSecondsOf(pending.effectiveFrom)) return false
    await this.options.rulesets.save(pending.ruleset)
    await this.options.pending.clear()
    await this.options.onPendingChanged?.(null)
    return true
  }

  private async read(): Promise<RulesState> {
    const [effective, pending] = await Promise.all([
      this.options.rulesets.load(),
      this.options.pending.load(),
    ])
    return { effective, pending }
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task)
    this.queue = run.catch(() => undefined)
    return run
  }
}
