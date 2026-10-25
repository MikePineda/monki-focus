// SPDX-License-Identifier: AGPL-3.0-or-later
import { DateTime } from 'luxon'

/**
 * The only reader of the wall clock. Domain modules never read it: services
 * pass `clock.now()` in. Resolved through the container, so tests swap it for
 * a fixed instant: `app.container.swap(Clock, () => fixedClock(...))`.
 */
export default class Clock {
  now(): DateTime {
    return DateTime.utc()
  }
}
