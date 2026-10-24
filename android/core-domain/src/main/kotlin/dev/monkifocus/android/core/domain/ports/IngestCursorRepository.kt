// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

/**
 * How far each ingest source has been copied, in epoch milliseconds (the
 * system usage events carry millisecond wall times). A cursor only moves
 * forward.
 */
interface IngestCursorRepository {
    /** The cursor of [source], or null before its first copy. */
    suspend fun get(source: String): Long?

    /** Moves the cursor of [source] to [epochMillis] unless it is already later; answers the stored value. */
    suspend fun advance(
        source: String,
        epochMillis: Long,
    ): Long
}
