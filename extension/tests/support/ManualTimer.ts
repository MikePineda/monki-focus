// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Timer } from '../../src/background/tracking/PulseScheduler'

/** Captures `setTimeout` calls so a test fires them when the clock says so. */
export class ManualTimer {
  private pending: { callback: () => void; delayMs: number }[] = []

  readonly set: Timer = (callback, delayMs) => {
    this.pending.push({ callback, delayMs })
  }

  /** Runs every captured callback (the test advanced the clock past their delay). */
  fireAll(): void {
    const due = this.pending
    this.pending = []
    for (const { callback } of due) callback()
  }

  get size(): number {
    return this.pending.length
  }
}
