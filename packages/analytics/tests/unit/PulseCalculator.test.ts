// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { pulse } from '../../src/index.ts'

describe('PulseCalculator', () => {
  it('zero_second_entries_are_no_tracked_time', () => {
    expect(pulse([{ seconds: 0, level: 100 }])).toBeNull()
  })

  it('all_very_productive_time_is_100_and_all_very_distracting_is_0', () => {
    expect(pulse([{ seconds: 60, level: 100 }])).toBe(100)
    expect(pulse([{ seconds: 60, level: 0 }])).toBe(0)
  })

  it('exact_halves_round_up_and_smaller_fractions_round_down', () => {
    // 50 / 4 = 12.5 → 13; 25 / 6 = 4.17 → 4.
    expect(
      pulse([
        { seconds: 3, level: 0 },
        { seconds: 1, level: 50 },
      ])
    ).toBe(13)
    expect(
      pulse([
        { seconds: 5, level: 0 },
        { seconds: 1, level: 25 },
      ])
    ).toBe(4)
  })
})
