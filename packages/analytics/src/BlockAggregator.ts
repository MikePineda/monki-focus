// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * 5-minute blocks (SEMANTICS.md §10.6): each attributed event is cut at UTC
 * 5-minute boundaries and summed per `(blockStart, source, activityKey,
 * categoryPath, level)`. With `syncActivityKey` off the key is `null` and
 * keys merge. One device's blocks never exceed 300 s per block start. Titles
 * and URLs known locally are never read.
 */
import type { AttributedEvent } from '@monki-focus/rules'
import { capAcrossDevices } from './CrossDeviceCapper.ts'
import { epochSecondsOf, utcInstantOf } from '@monki-focus/engine'
import type { SyncBlock } from './SyncBlock.ts'
import { BLOCK_SECONDS } from './SyncBlock.ts'

export interface BlockOptions {
  deviceId: string
  /** Whether blocks carry the domain or app id (off: `activityKey` is null). */
  syncActivityKey: boolean
}

export function toBlocks(events: readonly AttributedEvent[], options: BlockOptions): SyncBlock[] {
  const sums = new Map<string, SyncBlock>()
  for (const event of events) {
    const activityKey = options.syncActivityKey ? event.activityKey : null
    let cursor = epochSecondsOf(event.timestamp)
    const end = cursor + event.duration
    while (cursor < end) {
      const start = Math.floor(cursor / BLOCK_SECONDS) * BLOCK_SECONDS
      const pieceEnd = Math.min(start + BLOCK_SECONDS, end)
      const blockStart = utcInstantOf(start)
      const key = JSON.stringify([
        blockStart,
        event.source,
        activityKey,
        event.categoryPath,
        event.level,
      ])
      const seconds = (sums.get(key)?.seconds ?? 0) + pieceEnd - cursor
      sums.set(key, {
        deviceId: options.deviceId,
        blockStart,
        activityKey,
        categoryPath: event.categoryPath,
        level: event.level,
        source: event.source,
        seconds,
      })
      cursor = pieceEnd
    }
  }
  return capAcrossDevices([...sums.values()])
}
