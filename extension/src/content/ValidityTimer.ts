// SPDX-License-Identifier: AGPL-3.0-or-later
import { epochSecondsOf } from '@monki-focus/engine'
import type { Clock } from '../shared/clock'

/**
 * The longest a page waits before it asks again: a sleeping laptop or a
 * clock changed by hand can move `validUntil` without the page knowing.
 */
export const MAX_REVALIDATION_DELAY_MS = 15 * 60_000
/** Never sooner than this, so a late answer cannot make the page ask in a loop. */
export const MIN_REVALIDATION_DELAY_MS = 1_000

export interface ValidityTimerOptions {
  /** The clock the service worker decides on (`runtimeClock`, shifted in the e2e build). */
  clock: Clock
  /** Asks the service worker for the page's decision again. */
  reevaluate: () => void
}

/**
 * One timer per page at the answer's `validUntil` (SEMANTICS.md §5.6): the
 * decision cannot change before then with the same inputs, so the page asks
 * again exactly when a schedule edge, a bedtime or an intention end changes
 * it, instead of polling. Capped at `MAX_REVALIDATION_DELAY_MS`; without a
 * usable `validUntil` (`engine_error`) the page asks again after the cap.
 * Pushes from the service worker (`decision.changed`) still re-decide at once.
 */
export class ValidityTimer {
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(private readonly options: ValidityTimerOptions) {}

  /** Replaces the pending timer with one for this answer. */
  schedule(validUntil: string | null): void {
    this.stop()
    const delay = Math.min(
      Math.max(this.delayUntil(validUntil), MIN_REVALIDATION_DELAY_MS),
      MAX_REVALIDATION_DELAY_MS
    )
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.options.reevaluate()
    }, delay)
  }

  stop(): void {
    if (this.timer === undefined) return
    clearTimeout(this.timer)
    this.timer = undefined
  }

  private delayUntil(validUntil: string | null): number {
    if (validUntil === null) return MAX_REVALIDATION_DELAY_MS
    try {
      return epochSecondsOf(validUntil) * 1000 - this.options.clock.now()
    } catch {
      return MAX_REVALIDATION_DELAY_MS
    }
  }
}
