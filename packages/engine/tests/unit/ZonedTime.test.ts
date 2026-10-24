// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { epochSecondsOf, utcInstantOf } from '../../src/Instant.ts'
import {
  firstInstantReachingWall,
  localTimeAt,
  nextLocalMidnight,
  weekdayOfDay,
} from '../../src/ZonedTime.ts'

const wallOf = (year: number, month: number, day: number, hour: number, minute: number): number =>
  Date.UTC(year, month - 1, day, hour, minute) / 1000

describe('ZonedTime', () => {
  it('reads_the_local_wall_clock_of_the_pinned_zone', () => {
    expect(localTimeAt(epochSecondsOf('2026-10-26T12:00:00Z'), 'Australia/Sydney')).toEqual({
      dayNumber: 20752,
      weekday: 0,
      minuteOfDay: 23 * 60,
      localDate: '2026-10-26',
    })
  })

  it('numbers_weekdays_from_monday_also_before_the_epoch', () => {
    expect(weekdayOfDay(0)).toBe(3)
    expect(weekdayOfDay(-1)).toBe(2)
  })

  it('a_wall_time_inside_the_spring_forward_gap_resolves_to_the_first_instant_after_it', () => {
    const resolved = firstInstantReachingWall(
      epochSecondsOf('2026-10-03T12:00:00Z'),
      wallOf(2026, 10, 4, 2, 30),
      'Australia/Sydney'
    )
    expect(utcInstantOf(resolved)).toBe('2026-10-03T16:00:00Z')
  })

  it('a_repeated_fall_back_wall_time_resolves_to_its_next_occurrence', () => {
    const wall = wallOf(2026, 4, 5, 2, 30)
    const first = firstInstantReachingWall(
      epochSecondsOf('2026-04-04T12:00:00Z'),
      wall,
      'Australia/Sydney'
    )
    const second = firstInstantReachingWall(
      epochSecondsOf('2026-04-04T15:45:00Z'),
      wall,
      'Australia/Sydney'
    )
    expect(utcInstantOf(first)).toBe('2026-04-04T15:30:00Z')
    expect(utcInstantOf(second)).toBe('2026-04-04T16:30:00Z')
  })

  it('a_midnight_skipped_by_dst_resolves_to_the_first_existing_minute_of_the_day', () => {
    const midnight = nextLocalMidnight(epochSecondsOf('2026-09-05T12:00:00Z'), 'America/Santiago')
    expect(utcInstantOf(midnight)).toBe('2026-09-06T04:00:00Z')
    expect(localTimeAt(midnight, 'America/Santiago')).toMatchObject({
      localDate: '2026-09-06',
      minuteOfDay: 60,
    })
  })

  it('the_next_local_midnight_at_midnight_is_the_following_one', () => {
    const midnight = epochSecondsOf('2026-10-27T00:00:00Z')
    expect(utcInstantOf(nextLocalMidnight(midnight, 'UTC'))).toBe('2026-10-28T00:00:00Z')
  })
})

describe('Instant', () => {
  it('rejects_text_that_is_not_an_instant', () => {
    expect(() => epochSecondsOf('tomorrow')).toThrow(RangeError)
  })

  it('writes_computed_instants_in_utc_without_fractions', () => {
    expect(utcInstantOf(epochSecondsOf('2026-10-26T10:00:00+11:00'))).toBe('2026-10-25T23:00:00Z')
  })
})
