// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Clock } from '../../shared/clock'

/** The alarm that ends intentions and emergency overrides. */
export const GATE_TIMER_ALARM = 'gate.timers'

/** The slice of `alarms` the timers use. */
export interface TimerAlarmsApi {
  create(name: string, info: { when: number }): Promise<void> | void
  clear(name: string): Promise<boolean>
}

/**
 * One alarm at the earliest end of any intention or override (the engine's
 * `intentionExpiresAt` / `overrideEndsAt`). Alarms survive the service
 * worker sleeping; Chromium may run them up to ~30 s late, which is why the
 * page's own timer shows the timeout overlay on time and the alarm only
 * restores the redirect and ends what nobody is looking at.
 */
export class GateTimers {
  constructor(
    private readonly alarms: TimerAlarmsApi,
    private readonly clock: Clock,
    private readonly nextTimerAt: () => Promise<number | null>,
    /** The browser's own clock (alarms run on it, not on an e2e offset). */
    private readonly systemNow: () => number = () => Date.now()
  ) {}

  async schedule(): Promise<void> {
    const at = await this.nextTimerAt()
    if (at === null) {
      await this.alarms.clear(GATE_TIMER_ALARM)
      return
    }
    const delay = Math.max(0, at - this.clock.now())
    await this.alarms.create(GATE_TIMER_ALARM, { when: this.systemNow() + delay })
  }
}
