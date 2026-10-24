// SPDX-License-Identifier: AGPL-3.0-or-later

/** How often the tab is sampled and how far apart heartbeats may still merge. */
export interface TrackingTiming {
  /** Period of the `pulse` alarm, in seconds. */
  pulseSeconds: number
  /**
   * ActivityWatch pulsetime: a heartbeat with the same data at most this many
   * seconds after the open event's end extends it (1.5 × the pulse period).
   */
  pulsetimeSeconds: number
  /**
   * A `WINDOW_ID_NONE` focus change is only believed after this long: Brave
   * and DevTools report it briefly while the user stays in the browser.
   */
  focusGraceMs: number
  /** Period of the aggregation alarm (events → 5-minute blocks), in minutes. */
  aggregateMinutes: number
  /**
   * Treat the user as active whatever `idle.queryState` says. Only the e2e
   * build sets it: headless Chromium on a machine nobody touches reports
   * the OS idle time, so every probe would be idle. Never true in production.
   */
  assumeUserActive: boolean
}

/** Production: a pulse every 30 s (the `chrome.alarms` minimum), pulsetime 45 s (02 §1.9). */
export const PRODUCTION_TIMING: TrackingTiming = {
  pulseSeconds: 30,
  pulsetimeSeconds: 45,
  focusGraceMs: 2_000,
  aggregateMinutes: 5,
  assumeUserActive: false,
}

/**
 * The `e2e` build pulses every 2 s so Playwright sees tracked time within a
 * few seconds (unpacked extensions may use alarm periods under 30 s) and
 * assumes an active user (see `assumeUserActive`).
 */
export const E2E_TIMING: TrackingTiming = {
  pulseSeconds: 2,
  pulsetimeSeconds: 3,
  focusGraceMs: 2_000,
  aggregateMinutes: 5,
  assumeUserActive: true,
}

export function trackingTimingFor(mode: string): TrackingTiming {
  return mode === 'e2e' ? E2E_TIMING : PRODUCTION_TIMING
}
