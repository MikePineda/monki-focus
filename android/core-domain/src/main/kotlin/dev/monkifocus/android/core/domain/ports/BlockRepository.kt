// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

import dev.monkifocus.android.core.domain.analytics.ActivityBlock

/**
 * The local 5-minute blocks (SEMANTICS.md §10.6), kept without limit. Instants
 * are UTC RFC 3339 text aligned to 5 minutes.
 */
interface BlockRepository {
    /**
     * Idempotent upsert by natural key: a block with the same `(deviceId,
     * blockStart, activityKey, categoryPath, source, level)` replaces the
     * stored `seconds`, so applying the same blocks twice changes nothing.
     */
    suspend fun upsert(blocks: List<ActivityBlock>)

    /**
     * Makes [blocks] the device's whole content for block starts in
     * `[from, to)`: upserts them and deletes the device's other blocks there,
     * atomically. Answers the blocks that are new or whose seconds changed.
     */
    suspend fun replaceRange(
        deviceId: String,
        from: String,
        to: String,
        blocks: List<ActivityBlock>,
    ): List<ActivityBlock>

    /**
     * Blocks with `blockStart` in `[from, to)` in the canonical order:
     * `blockStart`, `deviceId`, `activityKey` (null first), `categoryPath`,
     * `source`, `level`.
     */
    suspend fun between(
        from: String,
        to: String,
    ): List<ActivityBlock>
}
