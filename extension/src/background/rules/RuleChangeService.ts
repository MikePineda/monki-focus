// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  effectiveRuleSet,
  epochSecondsOf,
  instantOf,
  nextLocalMidnight,
  utcInstantOf,
  type RulesCatalog,
} from '@monki-focus/engine'
import type { Ruleset, UtcInstant, ValidationResult } from '@monki-focus/rules/pure'
import type { Clock } from '../../shared/clock'
import {
  configuredRuleset,
  type PendingRuleChange,
  type RuleChangeOutcome,
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

      const { effectiveToday, effectiveFrom } = this.judge(current, next, now)
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

  /** Drops the pending change: what applies now stays, nothing gets looser. */
  cancelPending(): Promise<RulesState> {
    return this.exclusive(async () => {
      await this.options.pending.clear()
      await this.options.onPendingChanged?.(null)
      return this.read()
    })
  }

  /** Applies the pending change in full once `effectiveFrom` has passed. */
  promoteIfDue(): Promise<boolean> {
    return this.exclusive(() => this.promoteWhenDue())
  }

  private judge(
    current: RulesState,
    next: Ruleset,
    now: string
  ): { effectiveToday: Ruleset; effectiveFrom: UtcInstant | null } {
    if (!this.validate(current.effective).valid) {
      // An unreadable effective set cannot be compared with: the stored copy
      // fails closed until the next local midnight, then the proposal applies.
      const midnight = nextLocalMidnight(epochSecondsOf(now), next.timeZone)
      return { effectiveToday: current.effective, effectiveFrom: utcInstantOf(midnight) }
    }
    return effectiveRuleSet(
      current.effective,
      next,
      now,
      current.pending?.effectiveFrom ?? null,
      this.options.catalog
    )
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
