// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { toBlocks } from '../../src/index.ts'
import { makeAttributedEvent, makeBlock } from '../factories/ActivityFactory.ts'

const options = { deviceId: 'device-a', syncActivityKey: true }

describe('BlockAggregator', () => {
  it('zero_length_events_make_no_block', () => {
    expect(toBlocks([makeAttributedEvent({ duration: 0 })], options)).toStrictEqual([])
  })

  it('events_with_the_same_key_in_one_block_are_summed', () => {
    const events = [
      makeAttributedEvent({ timestamp: '2026-10-26T09:00:00Z', duration: 30 }),
      makeAttributedEvent({ timestamp: '2026-10-26T09:02:00Z', duration: 45 }),
    ]
    expect(toBlocks(events, options)).toStrictEqual([makeBlock({ seconds: 75 })])
  })

  it('a_different_level_or_source_is_a_different_block', () => {
    const events = [
      makeAttributedEvent({ duration: 30 }),
      makeAttributedEvent({ duration: 20, level: 25 }),
      makeAttributedEvent({ duration: 10, source: 'android' }),
    ]
    expect(toBlocks(events, options).map((block) => block.seconds)).toStrictEqual([10, 20, 30])
  })

  it('blocks_are_sorted_by_block_start', () => {
    const events = [
      makeAttributedEvent({ timestamp: '2026-10-26T09:10:00Z' }),
      makeAttributedEvent({ timestamp: '2026-10-26T09:00:00Z' }),
    ]
    expect(toBlocks(events, options).map((block) => block.blockStart)).toStrictEqual([
      '2026-10-26T09:00:00Z',
      '2026-10-26T09:10:00Z',
    ])
  })
})
