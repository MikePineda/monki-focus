// SPDX-License-Identifier: AGPL-3.0-or-later
/** Property tests for the analytics invariants (fast-check). */
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import type { AttributedEvent, CategoryLevel } from '@monki-focus/rules'
import { SYNC_BLOCK_FIELDS, capAcrossDevices, pulse, toBlocks } from '../../src/index.ts'
import type { SyncBlock } from '../../src/index.ts'

const START = Date.parse('2026-10-26T00:00:00Z') / 1000
const LEVELS: CategoryLevel[] = [0, 25, 50, 75, 100]
const ACTIVITY_KEYS = ['example.org', 'docs.example.org', 'org.example.Editor', 'example.net']
const CATEGORIES = ['reference', 'social', 'video/short-form', 'uncategorised']

const level = fc.constantFrom(...LEVELS)
const source = fc.constantFrom('web' as const, 'app' as const, 'android' as const)

function instant(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** Events anywhere in one day, overlapping freely. */
const attributedEvent = fc.record({
  timestamp: fc.integer({ min: 0, max: 86_400 }).map((offset) => instant(START + offset)),
  duration: fc.integer({ min: 0, max: 3_600 }),
  source,
  activityKey: fc.constantFrom(...ACTIVITY_KEYS),
  categoryPath: fc.constantFrom(...CATEGORIES),
  level,
}) satisfies fc.Arbitrary<AttributedEvent>

/** Back-to-back events separated by gaps, so no block can exceed 300 s. */
const sequentialEvents = fc
  .array(
    fc.record({
      gap: fc.integer({ min: 0, max: 900 }),
      duration: fc.integer({ min: 0, max: 2_000 }),
      source,
      activityKey: fc.constantFrom(...ACTIVITY_KEYS),
      categoryPath: fc.constantFrom(...CATEGORIES),
      level,
    }),
    { maxLength: 40 }
  )
  .map((pieces) => {
    let cursor = START
    return pieces.map(({ gap, duration, ...rest }): AttributedEvent => {
      cursor += gap
      const event = { timestamp: instant(cursor), duration, ...rest }
      cursor += duration
      return event
    })
  })

function secondsPerStart(blocks: readonly SyncBlock[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const block of blocks) {
    totals.set(block.blockStart, (totals.get(block.blockStart) ?? 0) + block.seconds)
  }
  return totals
}

describe('analytics properties', () => {
  it('split_preserves_total_seconds', () => {
    fc.assert(
      fc.property(sequentialEvents, fc.boolean(), (events, syncActivityKey) => {
        const blocks = toBlocks(events, { deviceId: 'device-a', syncActivityKey })
        const total = events.reduce((sum, event) => sum + event.duration, 0)
        expect(blocks.reduce((sum, block) => sum + block.seconds, 0)).toBe(total)
      })
    )
  })

  it('block_never_exceeds_300_seconds', () => {
    fc.assert(
      fc.property(fc.array(attributedEvent, { maxLength: 40 }), (events) => {
        const blocks = toBlocks(events, { deviceId: 'device-a', syncActivityKey: true })
        for (const block of blocks) {
          expect(block.seconds).toBeGreaterThanOrEqual(1)
          expect(block.seconds).toBeLessThanOrEqual(300)
        }
        for (const seconds of secondsPerStart(blocks).values()) {
          expect(seconds).toBeLessThanOrEqual(300)
        }
      })
    )
  })

  it('cross_device_cap_keeps_min_of_total_and_300_per_block_start', () => {
    const devices = fc.constantFrom('device-a', 'device-b', 'device-c')
    fc.assert(
      fc.property(
        fc.array(fc.tuple(devices, fc.array(attributedEvent, { maxLength: 10 })), { maxLength: 4 }),
        (perDevice) => {
          const blocks = perDevice.flatMap(([deviceId, events]) =>
            toBlocks(events, { deviceId, syncActivityKey: true })
          )
          const before = secondsPerStart(blocks)
          const after = secondsPerStart(capAcrossDevices(blocks))
          for (const [blockStart, seconds] of before) {
            expect(after.get(blockStart)).toBe(Math.min(seconds, 300))
          }
        }
      )
    )
  })

  it('pulse_is_between_0_and_100_or_null', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ seconds: fc.integer({ min: 0, max: 31_622_400 }), level }), {
          maxLength: 500,
        }),
        (entries) => {
          const value = pulse(entries)
          const total = entries.reduce((sum, entry) => sum + entry.seconds, 0)
          if (total === 0) {
            expect(value).toBeNull()
          } else {
            expect(Number.isInteger(value)).toBe(true)
            expect(value).toBeGreaterThanOrEqual(0)
            expect(value).toBeLessThanOrEqual(100)
          }
        }
      )
    )
  })

  it('synced_blocks_never_contain_titles_or_urls', () => {
    const marker = fc.string({ minLength: 1, maxLength: 40 }).map((text) => `\u0001${text}`)
    const eventWithSecrets = fc.record({
      event: attributedEvent,
      title: marker,
      url: fc.webUrl({ withQueryParameters: true, withFragments: true }),
    })
    fc.assert(
      fc.property(
        fc.array(eventWithSecrets, { maxLength: 20 }),
        fc.boolean(),
        (entries, syncActivityKey) => {
          const events: AttributedEvent[] = entries.map(({ event, title, url }) => ({
            ...event,
            title,
            url: `${url}#\u0002`,
          }))
          const blocks = toBlocks(events, { deviceId: 'device-a', syncActivityKey })
          const serialised = JSON.stringify(blocks)
          for (const block of blocks) {
            expect(Object.keys(block).sort()).toStrictEqual([...SYNC_BLOCK_FIELDS].sort())
            if (block.activityKey !== null) expect(ACTIVITY_KEYS).toContain(block.activityKey)
          }
          // Every title carries U+0001 and every URL U+0002: neither reaches a block.
          expect(serialised).not.toMatch(/\\u0001|\\u0002|:\/\//)
        }
      )
    )
  })
})
