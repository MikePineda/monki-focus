// SPDX-License-Identifier: AGPL-3.0-or-later
import { epochSecondsOf } from '@monki-focus/engine'
import type { UtcInstant } from '@monki-focus/rules/pure'
import type { Clock } from '../../shared/clock'

/** The one-shot alarm that re-decides when the earliest decision runs out. */
export const VALIDITY_ALARM = 'decision.validUntil'

/** The slice of `alarms` the validity alarm uses. */
export interface ValidityAlarmsApi {
  create(name: string, info: { when: number }): Promise<void> | void
  get(name: string): Promise<{ scheduledTime: number } | undefined>
}

/**
 * Every decision says until when it holds (`validUntil`, SEMANTICS.md
 * §5.6), so the service worker keeps one alarm at the earliest `validUntil`
 * still ahead of all the decisions it made, instead of polling: at that
 * instant the Shorts redirect, the gate's redirects and the open pages are
 * decided again (and offer their new `validUntil`). An earlier decision
 * moves the alarm forward; a later one never pushes it back, so a decision
 * that changed since only makes the alarm ring early, which is harmless.
 * The scheduled instant survives a sleeping worker in the alarm itself.
 * Alarms run on the browser's clock, the decisions on `clock` (shifted by
 * specs in the e2e build), so the delay is carried over, not the instant.
 */
export class ValidityAlarm {
  /** The scheduled instant on `clock` (epoch ms); undefined until read back after a restart. */
  private scheduledAt: number | null | undefined
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly alarms: ValidityAlarmsApi,
    private readonly clock: Clock,
    /** The browser's own clock (alarms run on it, not on an e2e offset). */
    private readonly systemNow: () => number = () => Date.now()
  ) {}

  /** A decision's `validUntil`; null (`engine_error`) schedules nothing. Never rejects. */
  offer(validUntil: UtcInstant | null): Promise<void> {
    const run = this.queue.then(() => this.schedule(validUntil))
    this.queue = run.catch(() => undefined)
    return run.catch(() => undefined)
  }

  /** The alarm rang: the next decisions schedule the next one. */
  rang(): void {
    this.scheduledAt = null
  }

  private async schedule(validUntil: UtcInstant | null): Promise<void> {
    if (validUntil === null) return
    const at = epochSecondsOf(validUntil) * 1000
    const now = this.clock.now()
    if (at <= now) return
    if (this.scheduledAt === undefined) {
      const existing = await this.alarms.get(VALIDITY_ALARM)
      this.scheduledAt =
        existing === undefined ? null : existing.scheduledTime - this.systemNow() + now
    }
    if (this.scheduledAt !== null && this.scheduledAt > now && this.scheduledAt <= at) return
    await this.alarms.create(VALIDITY_ALARM, { when: this.systemNow() + (at - now) })
    this.scheduledAt = at
  }
}
