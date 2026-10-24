// SPDX-License-Identifier: AGPL-3.0-or-later
import { browser } from 'wxt/browser'
import { systemClock } from './clock'
import { e2eClock, type E2eClock } from './E2eClock'

/**
 * The clock the gate, its timers and the decisions run on in this context:
 * the system clock, or in the e2e build the system clock plus the offset a
 * spec stored (`e2e.clockOffsetMs`). The check is a build-time constant, so
 * production bundles contain only the system clock.
 */
export function runtimeClock(): E2eClock {
  if (import.meta.env.MODE === 'e2e') {
    return e2eClock(browser.storage.local, browser.storage.onChanged, systemClock)
  }
  return { ...systemClock, ready: Promise.resolve() }
}
