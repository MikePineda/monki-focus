// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Whole seconds left until `endsAt` (epoch ms) at `now`, rounded up so a
 * wait shows "1" during its last second and "0" only once it is over.
 * Derived from the stored end time on every tick, never accumulated.
 */
export function remainingSeconds(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000))
}

/** `m:ss` for waits of a minute or more ("1:47"). */
export function formatMinutesSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
