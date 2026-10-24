// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Bedtime (SEMANTICS.md §6.2): `active` inside the nightly window, `warning`
 * during the `warnMinutesBefore` minutes before a listed start, otherwise
 * `inactive`. In `decide` bedtime blocks targets of category level ≤ 25
 * (§5.2.1) and is active when it is active in any pinned zone (§6.3).
 */
import type { Bedtime, Instant, TimeZone } from '@monki-focus/rules'
import { isInLeadUp, occurrenceAt } from './DailyWindow.ts'
import { epochSecondsOf } from './Instant.ts'
import { localTimeAt } from './ZonedTime.ts'

export type BedtimePhase = 'inactive' | 'warning' | 'active'

/** Highest category level bedtime blocks. */
export const BEDTIME_MAX_LEVEL = 25

/** The escalation group of emergency overrides requested from the bedtime screen. */
export const BEDTIME_GROUP = 'bedtime'

export function bedtimePhaseAt(
  bedtime: Bedtime,
  epochSeconds: number,
  timeZone: TimeZone
): BedtimePhase {
  if (!bedtime.enabled) return 'inactive'
  const local = localTimeAt(epochSeconds, timeZone)
  if (occurrenceAt(bedtime, local) !== null) return 'active'
  return isInLeadUp(bedtime, local, bedtime.warnMinutesBefore) ? 'warning' : 'inactive'
}

export function bedtimePhase(bedtime: Bedtime, now: Instant, timeZone: TimeZone): BedtimePhase {
  return bedtimePhaseAt(bedtime, epochSecondsOf(now), timeZone)
}

/** Bedtime is active when it is active in any of the pinned zones (§6.3). */
export function isBedtimeActive(
  bedtime: Bedtime,
  epochSeconds: number,
  zones: readonly TimeZone[]
): boolean {
  return zones.some((zone) => bedtimePhaseAt(bedtime, epochSeconds, zone) === 'active')
}
