// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { subtractIntervals, unionIntervals } from '../../src/index.ts'

describe('IntervalSet', () => {
  it('union_merges_overlapping_and_touching_intervals_and_drops_empty_ones', () => {
    expect(
      unionIntervals([
        { start: 20, end: 30 },
        { start: 0, end: 10 },
        { start: 0, end: 3 },
        { start: 10, end: 15 },
        { start: 5, end: 8 },
        { start: 40, end: 40 },
      ])
    ).toStrictEqual([
      { start: 0, end: 15 },
      { start: 20, end: 30 },
    ])
  })

  it('subtract_leaves_the_uncovered_pieces_in_order', () => {
    expect(
      subtractIntervals(
        [{ start: 0, end: 100 }],
        [
          { start: -10, end: 5 },
          { start: 20, end: 30 },
          { start: 50, end: 60 },
          { start: 200, end: 300 },
        ]
      )
    ).toStrictEqual([
      { start: 5, end: 20 },
      { start: 30, end: 50 },
      { start: 60, end: 100 },
    ])
  })

  it('subtract_skips_holes_already_passed_and_can_remove_everything', () => {
    expect(
      subtractIntervals(
        [
          { start: 0, end: 10 },
          { start: 20, end: 30 },
        ],
        [
          { start: 0, end: 10 },
          { start: 15, end: 35 },
        ]
      )
    ).toStrictEqual([])
  })

  it('subtract_does_not_mutate_its_inputs', () => {
    const minuend = [{ start: 0, end: 10 }]
    subtractIntervals(minuend, [{ start: 2, end: 4 }])
    expect(minuend).toStrictEqual([{ start: 0, end: 10 }])
  })
})
