// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Clock } from '../../shared/clock'
import type { Pulse } from './ActivityTracker'
import type { IdleWatcher } from './IdleWatcher'
import { ensureAlarm } from './PeriodicAlarm'
import type { TrackingBrowser } from './TrackingBrowser'
import type { TrackingTiming } from './TrackingTiming'
import type { WindowFocusGrace } from './WindowFocusGrace'

/** Name of the periodic sampling alarm. */
export const PULSE_ALARM = 'pulse'

export type Timer = (callback: () => void, delayMs: number) => void

export interface PulseSchedulerDependencies {
  browser: Pick<TrackingBrowser, 'windows' | 'tabs' | 'alarms'>
  idle: Pick<IdleWatcher, 'start'>
  focus: WindowFocusGrace
  clock: Clock
  timing: TrackingTiming
  pulse: (pulse: Pulse) => unknown
  /** `setTimeout` in production; tests pass a manual timer. */
  setTimer?: Timer
}

/**
 * Decides when to sample: the `pulse` alarm every `pulseSeconds`, and at
 * once on a tab switch, a URL change, a window focus change or an idle state
 * change. Losing focus to `WINDOW_ID_NONE` samples only after the focus
 * grace, closing the open event at the moment focus left.
 *
 * Listeners are added synchronously in `start()`, from the service worker's
 * first turn, so Chromium wakes the worker for them.
 */
export class PulseScheduler {
  constructor(private readonly deps: PulseSchedulerDependencies) {}

  start(): void {
    const { browser, focus, clock, timing } = this.deps
    const setTimer = this.deps.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs))
    const now = () => clock.now()

    browser.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === PULSE_ALARM) this.fire(null)
    })
    browser.tabs.onActivated.addListener(() => this.fire(now()))
    browser.tabs.onUpdated.addListener((_tabId, change) => {
      if (change.url !== undefined) this.fire(now())
    })
    browser.windows.onFocusChanged.addListener((windowId) => {
      if (windowId !== browser.windows.WINDOW_ID_NONE) {
        focus.focusGained()
        this.fire(now())
        return
      }
      focus.focusLost(now())
      setTimer(() => {
        const lostAt = focus.lostAt()
        // Focus came back within the grace: the regular pulses carry on.
        if (lostAt !== null) this.fire(lostAt)
      }, timing.focusGraceMs)
    })
    this.deps.idle.start(() => this.fire(null))
    void ensureAlarm(browser.alarms, PULSE_ALARM, timing.pulseSeconds / 60)
    this.fire(null)
  }

  private fire(closeAtMs: number | null): void {
    void this.deps.pulse({ closeAtMs })
  }
}
