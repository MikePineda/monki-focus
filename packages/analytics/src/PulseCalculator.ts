// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The focus pulse (SEMANTICS.md §10.5): `round(Σ(seconds × level) / Σ seconds)`
 * rounded half up, identical to RescueTime's `Σ(s × k) / (Σ s × 4) × 100`
 * with `k = level / 25`. `null` without tracked time. Integer arithmetic
 * only, so every platform rounds identically.
 */
import type { CategoryLevel, Pulse } from '@monki-focus/rules'

export interface PulseInput {
  seconds: number
  level: CategoryLevel
}

export function pulse(entries: readonly PulseInput[]): Pulse {
  let total = 0
  let weighted = 0
  for (const entry of entries) {
    total += entry.seconds
    weighted += entry.seconds * entry.level
  }
  if (total === 0) return null
  // Half up: floor(weighted / total + 1/2) without floating point.
  return Math.floor((weighted * 2 + total) / (total * 2))
}
