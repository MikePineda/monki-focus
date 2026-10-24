// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Wall-clock time in an IANA zone without the device zone, `Temporal` or a
 * time-zone database of our own: `Intl.DateTimeFormat` with an explicit
 * `timeZone` exists in Chromium service workers and in Node 24 alike and is
 * the only zone lookup the engine uses (SEMANTICS.md §6.3).
 *
 * A **wall second** counts seconds since 1970-01-01 00:00 *local* time, so a
 * local date is `floor(wall / 86400)` and wall-clock arithmetic is plain
 * integer arithmetic, which is what makes DST transitions harmless (§6.1).
 */

const SECONDS_PER_DAY = 86_400

/** Monday = 0 … Sunday = 6, the order of `Weekday`. 1970-01-01 was a Thursday. */
const EPOCH_DAY_WEEKDAY = 3

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone)
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    formatters.set(timeZone, formatter)
  }
  return formatter
}

/** Throws a RangeError unless `timeZone` resolves in the time zone database (§14). */
export function assertResolvableTimeZone(timeZone: string): void {
  formatterFor(timeZone)
}

/** The local wall second of an instant (epoch seconds) in `timeZone`. */
export function wallSecondsAt(epochSeconds: number, timeZone: string): number {
  const fields: Record<string, string> = {}
  for (const part of formatterFor(timeZone).formatToParts(new Date(epochSeconds * 1000))) {
    fields[part.type] = part.value
  }
  const wallMillis = Date.UTC(
    Number(fields.year),
    Number(fields.month) - 1,
    Number(fields.day),
    Number(fields.hour),
    Number(fields.minute),
    Number(fields.second)
  )
  return Math.floor(wallMillis / 1000)
}

/** A local wall-clock reading split into its local day and minute. */
export interface LocalTime {
  /** Days since 1970-01-01 in local time. */
  dayNumber: number
  /** Monday = 0 … Sunday = 6. */
  weekday: number
  /** Whole minutes since local midnight, 0…1439. */
  minuteOfDay: number
  /** `YYYY-MM-DD`. */
  localDate: string
}

export function localTimeAt(epochSeconds: number, timeZone: string): LocalTime {
  const wall = wallSecondsAt(epochSeconds, timeZone)
  const dayNumber = Math.floor(wall / SECONDS_PER_DAY)
  return {
    dayNumber,
    weekday: weekdayOfDay(dayNumber),
    minuteOfDay: Math.floor((wall - dayNumber * SECONDS_PER_DAY) / 60),
    localDate: new Date(dayNumber * SECONDS_PER_DAY * 1000).toISOString().slice(0, 10),
  }
}

/** Monday = 0 … Sunday = 6 for a local day number (negative day numbers included). */
export function weekdayOfDay(dayNumber: number): number {
  return (((dayNumber + EPOCH_DAY_WEEKDAY) % 7) + 7) % 7
}

/**
 * The first instant after `afterEpochSeconds` whose wall clock reads at least
 * `wall` (a wall second later than the wall clock at `after`). A wall time in
 * a spring-forward gap resolves to the first existing instant after the gap;
 * a repeated fall-back time resolves to its first occurrence after `after`.
 */
export function firstInstantReachingWall(
  afterEpochSeconds: number,
  wall: number,
  timeZone: string
): number {
  const offsetAt = (epochSeconds: number): number =>
    wallSecondsAt(epochSeconds, timeZone) - epochSeconds
  // Offsets are at most ±14 h, so the zone's offsets around `wall` are those a day either side.
  const offsets = [
    ...new Set([
      offsetAt(wall - SECONDS_PER_DAY),
      offsetAt(wall),
      offsetAt(wall + SECONDS_PER_DAY),
    ]),
  ]
  const exact = offsets
    .map((offset) => wall - offset)
    .filter((candidate) => candidate > afterEpochSeconds)
    .filter((candidate) => wallSecondsAt(candidate, timeZone) === wall)
    .sort((a, b) => a - b)
  const [first] = exact
  if (first !== undefined) return first
  // The wall time falls in a gap: binary-search the transition that skips it.
  let low = Math.max(afterEpochSeconds, wall - Math.max(...offsets) - 1)
  let high = wall - Math.min(...offsets)
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    if (wallSecondsAt(middle, timeZone) >= wall) high = middle
    else low = middle
  }
  return Math.max(high, afterEpochSeconds + 1)
}

/** Wall seconds of the start of a local day. */
export function wallSecondsOfDay(dayNumber: number): number {
  return dayNumber * SECONDS_PER_DAY
}

/** The first instant of the local day after the one `epochSeconds` falls in (§8 step 1). */
export function nextLocalMidnight(epochSeconds: number, timeZone: string): number {
  const today = localTimeAt(epochSeconds, timeZone).dayNumber
  return firstInstantReachingWall(epochSeconds, wallSecondsOfDay(today + 1), timeZone)
}
