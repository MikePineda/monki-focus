// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SyncBlock } from '@monki-focus/analytics'

/** The local 5-minute blocks (kept without limit). */
export interface BlockRepository {
  /**
   * Idempotent upsert by natural key: a block with the same `(deviceId,
   * blockStart, activityKey, categoryPath, source, level)` replaces the stored
   * `seconds`, so applying the same blocks twice changes nothing.
   */
  upsert(blocks: readonly SyncBlock[]): Promise<void>
  /**
   * Makes `blocks` the device's whole content for block starts in
   * `[from, to)`: upserts them and deletes the device's other blocks there.
   * Answers the blocks that are new or whose seconds changed.
   */
  replaceRange(
    deviceId: string,
    from: string,
    to: string,
    blocks: readonly SyncBlock[]
  ): Promise<SyncBlock[]>
  /** Blocks with `blockStart` in `[from, to)`, by block start. */
  between(from: string, to: string): Promise<SyncBlock[]>
}
