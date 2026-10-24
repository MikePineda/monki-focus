// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IdleState, TrackingBrowser } from './TrackingBrowser'

/** Seconds without input before Chromium reports `idle` (02 §1.9). */
export const IDLE_DETECTION_SECONDS = 60

/**
 * The user's idle state. `state()` asks Chromium every time instead of
 * caching the last event, so a service worker that just woke up still knows.
 */
export class IdleWatcher {
  constructor(
    private readonly idle: TrackingBrowser['idle'],
    /** e2e build only (`TrackingTiming.assumeUserActive`). */
    private readonly assumeUserActive = false
  ) {}

  /** Sets the detection interval and reports every state change. */
  start(onChange: (state: IdleState) => void): void {
    this.idle.setDetectionInterval(IDLE_DETECTION_SECONDS)
    this.idle.onStateChanged.addListener(onChange)
  }

  async state(): Promise<IdleState> {
    if (this.assumeUserActive) return 'active'
    return this.idle.queryState(IDLE_DETECTION_SECONDS)
  }
}
