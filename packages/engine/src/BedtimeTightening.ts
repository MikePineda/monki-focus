// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Bedtime changes (SEMANTICS.md §8): tightening iff bedtime becomes enabled,
 * or stays enabled with `days` and window whose week set contains the old
 * one. `warnMinutesBefore` is neutral; anything else waits.
 */
import type { Bedtime } from '@monki-focus/rules'
import { jsonEqual } from './JsonEquality.ts'
import { weekSetContains, weekSetOf } from './WeekSet.ts'

/** Everything but the neutral `warnMinutesBefore`. */
function windowOf(bedtime: Bedtime): Omit<Bedtime, 'warnMinutesBefore'> {
  return { enabled: bedtime.enabled, days: bedtime.days, start: bedtime.start, end: bedtime.end }
}

export function bedtimeChangeWaits(previous: Bedtime, next: Bedtime): boolean {
  if (jsonEqual(windowOf(previous), windowOf(next))) return false
  if (!next.enabled) return true
  if (!previous.enabled) return false
  return !weekSetContains(weekSetOf([next]), weekSetOf([previous]))
}
