// SPDX-License-Identifier: AGPL-3.0-or-later
import { DateTime } from 'luxon'
import Clock from '#services/clock'
import app from '@adonisjs/core/services/app'

/** A clock stuck at `iso`, movable with `advance`. */
export class FixedClock extends Clock {
  constructor(protected instant: DateTime) {
    super()
  }

  override now(): DateTime {
    return this.instant
  }

  advance(duration: Parameters<DateTime['plus']>[0]) {
    this.instant = this.instant.plus(duration)
  }
}

export function fixedClock(iso: string) {
  return new FixedClock(DateTime.fromISO(iso, { zone: 'utc' }))
}

/**
 * Laravel's `Carbon::setTestNow`: every service resolved from the container
 * reads this clock until `app.container.restore(Clock)` (call it in a
 * teardown).
 */
export function freezeTime(iso: string) {
  const clock = fixedClock(iso)
  app.container.swap(Clock, () => clock)
  return clock
}
