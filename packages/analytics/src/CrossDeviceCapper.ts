// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The 300-second cap on one block start (SEMANTICS.md §10.9, server side,
 * and §10.6, one device): per `blockStart`, blocks adding up to more than
 * 300 s are scaled by largest remainder, ties by `deviceId`, `activityKey`,
 * `categoryPath` (then `source`, `level`); blocks that reach 0 are dropped.
 * Output in canonical block order.
 */
import { scaleToCap } from './LargestRemainder.ts'
import type { SyncBlock } from './SyncBlock.ts'
import { BLOCK_SECONDS, compareSyncBlocks, toSyncBlock } from './SyncBlock.ts'

export function capAcrossDevices(blocks: readonly SyncBlock[]): SyncBlock[] {
  const byStart = new Map<string, SyncBlock[]>()
  for (const block of blocks) {
    const group = byStart.get(block.blockStart)
    if (group === undefined) byStart.set(block.blockStart, [block])
    else group.push(block)
  }
  return [...byStart.values()]
    .flatMap((group) => scaleToCap(group, BLOCK_SECONDS, compareSyncBlocks))
    .filter((block) => block.seconds > 0)
    .map((block) => toSyncBlock(block))
    .sort(compareSyncBlocks)
}
