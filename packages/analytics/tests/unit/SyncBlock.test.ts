// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { SYNC_BLOCK_FIELDS, compareSyncBlocks, toSyncBlock } from '../../src/index.ts'
import type { SyncBlock } from '../../src/index.ts'
import { makeBlock } from '../factories/ActivityFactory.ts'

describe('SyncBlock', () => {
  it('only_the_seven_block_fields_are_copied', () => {
    const leaky = { ...makeBlock(), title: 'Private', url: 'https://example.org/private' }
    expect(Object.keys(toSyncBlock(leaky)).sort()).toStrictEqual([...SYNC_BLOCK_FIELDS].sort())
  })

  it('a_null_activity_key_is_accepted', () => {
    expect(toSyncBlock(makeBlock({ activityKey: null })).activityKey).toBeNull()
  })

  it.each<[string, Partial<SyncBlock>]>([
    ['deviceId', { deviceId: 'device a' }],
    ['blockStart', { blockStart: '2026-10-26T09:03:00Z' }],
    ['activityKey', { activityKey: 'https://example.org/private' }],
    ['activityKey', { activityKey: 'Weekly discussion thread' }],
    ['categoryPath', { categoryPath: 'Social Media' }],
    ['categoryPath', { categoryPath: `a${'/b'.repeat(48)}` }],
    ['level', { level: 60 as SyncBlock['level'] }],
    ['source', { source: 'ios' as SyncBlock['source'] }],
    ['seconds', { seconds: 0 }],
    ['seconds', { seconds: 301 }],
    ['seconds', { seconds: 1.5 }],
  ])('a_block_with_an_invalid_%s_is_rejected', (field, overrides) => {
    expect(() => toSyncBlock(makeBlock(overrides))).toThrow(`Invalid sync block ${field}`)
  })

  it('canonical_order_puts_a_null_activity_key_first_and_is_total', () => {
    const blocks = [
      makeBlock({ activityKey: 'b.example', level: 75 }),
      makeBlock({ activityKey: 'b.example', level: 25 }),
      makeBlock({ activityKey: 'b.example', source: 'app' }),
      makeBlock({ activityKey: null }),
      makeBlock({ activityKey: 'a.example', categoryPath: 'z' }),
      makeBlock({ activityKey: 'a.example', categoryPath: 'a' }),
      makeBlock({ deviceId: 'device-0' }),
      makeBlock({ blockStart: '2026-10-26T08:55:00Z' }),
    ]
    const sorted = [...blocks].sort(compareSyncBlocks)
    expect(
      sorted.map((block) => [
        block.blockStart.slice(11, 16),
        block.deviceId,
        block.activityKey,
        block.categoryPath,
        block.source,
        block.level,
      ])
    ).toStrictEqual([
      ['08:55', 'device-a', 'example.org', 'reference', 'web', 75],
      ['09:00', 'device-0', 'example.org', 'reference', 'web', 75],
      ['09:00', 'device-a', null, 'reference', 'web', 75],
      ['09:00', 'device-a', 'a.example', 'a', 'web', 75],
      ['09:00', 'device-a', 'a.example', 'z', 'web', 75],
      ['09:00', 'device-a', 'b.example', 'reference', 'app', 75],
      ['09:00', 'device-a', 'b.example', 'reference', 'web', 25],
      ['09:00', 'device-a', 'b.example', 'reference', 'web', 75],
    ])
    expect(compareSyncBlocks(makeBlock(), makeBlock())).toBe(0)
  })
})
