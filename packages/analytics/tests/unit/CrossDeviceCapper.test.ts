// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { capAcrossDevices, scaleToCap } from '../../src/index.ts'
import { makeBlock } from '../factories/ActivityFactory.ts'

describe('CrossDeviceCapper', () => {
  it('a_block_scaled_to_zero_is_dropped', () => {
    const blocks = [
      makeBlock({ deviceId: 'device-a', seconds: 1 }),
      makeBlock({ deviceId: 'device-b', seconds: 299 }),
      makeBlock({ deviceId: 'device-c', seconds: 299 }),
    ]
    expect(capAcrossDevices(blocks).map((block) => [block.deviceId, block.seconds])).toStrictEqual([
      ['device-b', 150],
      ['device-c', 150],
    ])
  })

  it('each_block_start_is_capped_on_its_own', () => {
    const blocks = [
      makeBlock({ blockStart: '2026-10-26T09:05:00Z', deviceId: 'device-a', seconds: 300 }),
      makeBlock({ blockStart: '2026-10-26T09:00:00Z', deviceId: 'device-b', seconds: 200 }),
      makeBlock({ blockStart: '2026-10-26T09:05:00Z', deviceId: 'device-b', seconds: 300 }),
    ]
    expect(
      capAcrossDevices(blocks).map((block) => [block.blockStart.slice(11, 16), block.seconds])
    ).toStrictEqual([
      ['09:00', 200],
      ['09:05', 150],
      ['09:05', 150],
    ])
  })

  it('largest_remainder_keeps_the_input_order_and_sums_to_the_cap', () => {
    const scaled = scaleToCap([{ seconds: 1 }, { seconds: 1 }, { seconds: 1 }], 2, () => 0).map(
      (item) => item.seconds
    )
    expect(scaled).toStrictEqual([1, 1, 0])
  })

  it('under_the_cap_items_are_copied_unchanged', () => {
    const items = [{ seconds: 5 }]
    const scaled = scaleToCap(items, 300, () => 0)
    expect(scaled).toStrictEqual(items)
    expect(scaled[0]).not.toBe(items[0])
  })
})
