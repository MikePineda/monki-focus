// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Clock } from '../../src/shared/clock'

/** A wall clock tests move by hand (`Carbon::setTestNow` plus travel). */
export class ManualClock implements Clock {
  private wall: number
  private mono = 0

  constructor(iso: string) {
    this.wall = Date.parse(iso)
    if (Number.isNaN(this.wall)) throw new RangeError(`ManualClock needs an ISO instant: ${iso}`)
  }

  now(): number {
    return this.wall
  }

  monotonic(): number {
    return this.mono
  }

  advanceSeconds(seconds: number): void {
    this.wall += seconds * 1000
    this.mono += seconds * 1000
  }

  set(iso: string): void {
    this.wall = Date.parse(iso)
  }
}
