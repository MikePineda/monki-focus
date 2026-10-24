// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { formatMinutesSeconds, remainingSeconds } from '../../../src/ui/RemainingTime'

describe('RemainingTime', () => {
  it('remaining_seconds_round_up_so_the_last_second_still_shows_one', () => {
    expect(remainingSeconds(10_000, 0)).toBe(10)
    expect(remainingSeconds(10_000, 9_001)).toBe(1)
    expect(remainingSeconds(10_000, 9_999)).toBe(1)
  })

  it('remaining_seconds_never_go_negative', () => {
    expect(remainingSeconds(10_000, 10_000)).toBe(0)
    expect(remainingSeconds(10_000, 60_000)).toBe(0)
  })

  it('minutes_and_seconds_pad_the_seconds', () => {
    expect(formatMinutesSeconds(107)).toBe('1:47')
    expect(formatMinutesSeconds(120)).toBe('2:00')
    expect(formatMinutesSeconds(605)).toBe('10:05')
  })
})
